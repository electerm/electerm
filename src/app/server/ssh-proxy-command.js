/**
 * ssh proxy command support
 *
 * Connects through an external stdio proxy command (like OpenSSH ProxyCommand):
 * the command is expected to speak the SSH protocol on its stdin/stdout.
 *
 * Used for:
 *  - netbird ssh proxy (auto-detected via `netbird ssh detect`, see
 *    https://github.com/electerm/electerm/issues/4500)
 *  - generic user-defined proxyCommand option (supports %h %p %r placeholders,
 *    e.g. `cloudflared access ssh --hostname %h`)
 *
 * Because @electerm/ssh2 requires a real net.Socket with full semantics
 * (setKeepAlive/destroy/connecting), we bridge the child stdio through a
 * loopback socketpair instead of patching a fake socket.
 */

const { spawn } = require('child_process')
const net = require('net')
const log = require('../common/log')

// resolved lazily so tests (and users) can override via env at any time
function getNetbirdBin () {
  return process.env.ELECTERM_NETBIRD_BIN || 'netbird'
}

// how long to wait for `netbird ssh detect` before giving up and connecting directly
const detectTimeout = 5 * 1000

// netbird CGNAT range 100.64.0.0/10
function isNetbirdLikeHost (host) {
  if (typeof host !== 'string' || !host) {
    return false
  }
  const h = host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) {
    // netbird also registers dns names, but avoid spawning a process
    // for every arbitrary hostname connection
    return false
  }
  const a = Number(m[1])
  const b = Number(m[2])
  return a === 100 && b >= 64 && b <= 127
}

/**
 * detect if target is a netbird JWT ssh server
 * `netbird ssh detect` exits 0 when the server requires netbird JWT auth
 */
function detectNetbird (host, port) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(getNetbirdBin(), ['ssh', 'detect', host, String(port)], {
        stdio: 'ignore'
      })
    } catch (e) {
      log.warn('spawn netbird detect failed', e.message)
      return resolve(false)
    }
    const timer = setTimeout(() => {
      child.kill()
      resolve(false)
    }, detectTimeout)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

// cache detection result per host:port for the process lifetime,
// so reconnects do not spawn `netbird ssh detect` again
const detectCache = new Map()

/**
 * build proxy command command/args from template string with %h %p %r placeholders
 */
function expandProxyCommand (command, { host, port, username }) {
  const expanded = command
    .replace(/%h/g, host)
    .replace(/%p/g, String(port))
    .replace(/%r/g, username || '')
  return expanded.trim().split(/\s+/).filter(Boolean)
}

/**
 * create a loopback socketpair bridging to child stdio:
 * ssh2 client connects a normal tcp socket to 127.0.0.1:<random>,
 * the listener pipes both directions to the child process
 */
function bridgeChildStdio (child) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    let settled = false
    server.once('error', (err) => {
      if (settled) {
        return
      }
      settled = true
      reject(err)
    })
    server.listen(0, '127.0.0.1', () => {
      if (settled) {
        return
      }
      settled = true
      const { port } = server.address()
      resolve({ server, port })
    })
    server.once('connection', (socket) => {
      server.close()
      socket.pipe(child.stdin)
      child.stdout.pipe(socket)
      const cleanup = () => {
        socket.destroy()
        try {
          child.kill()
        } catch {

        }
      }
      child.stdout.once('end', cleanup)
      child.stdout.once('error', cleanup)
      child.once('exit', () => socket.destroy())
      socket.once('error', () => {
        log.log('proxy command bridge socket error')
        try {
          child.kill()
        } catch {

        }
      })
    })
  })
}

/**
 * spawn proxy command and resolve { socket, dispose }
 * socket is an ordinary net.Socket connected to the bridge
 */
async function runProxyCommand (command, args, { onMessage } = {}) {
  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  })
  const stderrBuf = []
  child.stderr?.on('data', (d) => {
    const text = d.toString()
    stderrBuf.push(text)
    onMessage && onMessage(text)
  })
  const [bridge, socket] = await new Promise((resolve, reject) => {
    let settled = false
    const onSpawnError = (err) => {
      if (settled) {
        return
      }
      settled = true
      reject(new Error(`proxy command failed to start: ${command}: ${err.message}`))
    }
    child.once('error', onSpawnError)
    bridgeChildStdio(child).then(
      ({ server, port }) => {
        if (settled) {
          return
        }
        settled = true
        child.removeListener('error', onSpawnError)
        const socket = net.connect(port, '127.0.0.1')
        socket.once('connect', () => resolve([server, socket]))
        socket.once('error', (err) => {
          reject(err)
        })
      },
      (err) => {
        if (settled) {
          return
        }
        settled = true
        reject(err)
      }
    )
  })
  let disposed = false
  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    socket.destroy()
    try {
      child.stdin?.end()
    } catch {

    }
    child.kill()
    bridge.close()
    log.log('proxy command disposed:', command, args.join(' '))
  }
  child.once('exit', () => {
    socket.destroy()
  })
  socket.once('close', () => {
    if (!disposed) {
      disposed = true
      try {
        child.stdin?.end()
      } catch {

      }
      child.kill()
      bridge.close()
    }
  })
  return {
    socket,
    dispose,
    stderr: () => stderrBuf.join('')
  }
}

/**
 * main entry: decide whether to connect through a proxy command
 * returns { socket, dispose, stderr } or null when not applicable
 */
async function maybeProxyCommand (initOptions, connectOptions, { onMessage } = {}) {
  const host = connectOptions.host || initOptions.host
  const port = connectOptions.port || initOptions.port || 22
  let command
  let args
  if (initOptions.proxyCommand) {
    const expanded = expandProxyCommand(initOptions.proxyCommand, {
      host,
      port,
      username: connectOptions.username || initOptions.username
    })
    if (!expanded.length) {
      return null
    }
    command = expanded.shift()
    args = expanded
  } else if (
    !initOptions.proxy &&
    !connectOptions.sock &&
    isNetbirdLikeHost(host)
  ) {
    const key = `${host}:${port}`
    let detected = detectCache.get(key)
    if (detected === undefined) {
      detected = await detectNetbird(host, port)
      detectCache.set(key, detected)
    }
    if (!detected) {
      return null
    }
    command = getNetbirdBin()
    args = ['ssh', 'proxy', host, String(port)]
  } else {
    return null
  }
  log.log('using ssh proxy command:', command, args.join(' '))
  return runProxyCommand(command, args, { onMessage })
}

function clearDetectCache () {
  detectCache.clear()
}

exports.maybeProxyCommand = maybeProxyCommand
exports.expandProxyCommand = expandProxyCommand
exports.detectNetbird = detectNetbird
exports.isNetbirdLikeHost = isNetbirdLikeHost
exports.clearDetectCache = clearDetectCache
