/**
 * x11 helpers
 *
 * electerm does not render x11 itself, it only forwards the protocol through
 * the ssh channel, so a local x server (XQuartz / VcXsrv / X.org) must be
 * running and reachable. When it is not, remote GUI apps hang or die without
 * any visible reason, so we probe the display up front and hand the user a
 * hint when it cannot be reached.
 */

const net = require('net')
const { execFile } = require('child_process')

const X11_HELP_URL = 'https://github.com/electerm/electerm/wiki/Use-X11'
const unixSocketDir = '/tmp/.X11-unix'
const defaultTcpPort = 6000
const probeTimeout = 800

/**
 * endpoints to try when looking for a local x server, most likely first
 * @param {string} display raw DISPLAY value: ':0', 'localhost:1.0' or an
 *   absolute socket path (XQuartz on macOS)
 * @param {string} platform process.platform
 * @return {Array<{path?: string, port?: number, host?: string}>}
 */
function getX11Candidates (display, platform = process.platform) {
  const d = (display || '').trim()
  // XQuartz: DISPLAY already is the socket path
  if (d.includes('/')) {
    return [{ path: d }]
  }
  const list = []
  const m = d.match(/:(\d+)(?:\.(\d+))?$/)
  const n = m ? parseInt(m[1], 10) : 0
  const onWindows = platform === 'win32'
  if (!onWindows) {
    list.push({ path: `${unixSocketDir}/X${n}` })
  }
  if (defaultTcpPort + n <= 65535) {
    list.push({ port: defaultTcpPort + n, host: '127.0.0.1' })
  }
  if (n !== 0) {
    if (!onWindows) {
      list.push({ path: `${unixSocketDir}/X0` })
    }
    list.push({ port: defaultTcpPort, host: '127.0.0.1' })
  }
  return list
}

function probeOne (endpoint, timeout) {
  return new Promise((resolve) => {
    let timer = null
    let done = false
    const finish = (r) => {
      if (done) {
        return
      }
      done = true
      if (timer) {
        clearTimeout(timer)
      }
      sock.destroy()
      resolve(r)
    }
    const sock = new net.Socket()
    timer = setTimeout(() => finish(false), timeout)
    sock
      .once('connect', () => finish(true))
      .once('error', () => finish(false))
    try {
      if (endpoint.path) {
        sock.connect(endpoint.path)
      } else {
        sock.connect(endpoint.port, endpoint.host || '127.0.0.1')
      }
    } catch (e) {
      finish(false)
    }
  })
}

/**
 * is any of the candidate endpoints connectable?
 * @param {Array} candidates from getX11Candidates
 * @param {number} timeout per endpoint, ms
 * @return {Promise<boolean>}
 */
function probeXServer (candidates, timeout = probeTimeout) {
  return candidates.reduce((prev, c) => {
    return prev.then(found => found || probeOne(c, timeout))
  }, Promise.resolve(false))
}

/**
 * hint shown when no local x server answers
 * @param {string} platform process.platform
 */
function x11Hint (platform = process.platform) {
  if (platform === 'darwin') {
    return 'X11 forwarding is on, but no local X server was found. Install and start XQuartz (https://www.xquartz.org), log out and back in so DISPLAY is set, then reconnect.'
  }
  if (platform === 'win32') {
    return 'X11 forwarding is on, but no local X server was found. Start VcXsrv (or Xming) with XLaunch on display number 0, keep "Disable access control" checked, make sure it listens on 127.0.0.1:6000, then reconnect.'
  }
  return 'X11 forwarding is on, but no local X server was found. Start your X session (or install an X server and xauth), then reconnect.'
}

/**
 * hint shown when the x server answers but we got no auth cookie
 * @param {string} platform process.platform
 */
function x11CookieHint (platform = process.platform) {
  const base = 'No X11 auth cookie could be read (xauth missing or no entry for the current display), the X server may reject remote GUI apps.'
  if (platform === 'darwin') {
    // XQuartz ships xauth at /opt/X11/bin, which is not on the PATH of apps
    // launched from Finder/Dock
    return `${base} XQuartz puts xauth in /opt/X11/bin, start electerm from a shell that has it on PATH, or turn off "Authenticate connections" in XQuartz settings.`
  }
  return `${base} Check with "xauth list", or open access with "xhost +localhost".`
}

function notifyX11 (session, message) {
  if (!session.ws || session.x11Notified) return
  session.x11Notified = true
  session.ws.s({
    action: 'x11-warning',
    message,
    url: X11_HELP_URL,
    tabId: session.initOptions.srcTabId
  })
}

async function prepareX11 (session) {
  session.display = process.env.DISPLAY || ''
  session.x11Cookie = await new Promise(resolve => {
    execFile('xauth', ['list', session.display || ':0'], (err, out, stderr) => {
      const cookie = !err && !stderr && out.match(/MIT-MAGIC-COOKIE-1\s+([\da-f]+)/i)
      resolve(cookie ? cookie[1] : '')
    })
  })
  // A diagnostic probe must not delay the SSH login.
  probeXServer(getX11Candidates(session.display)).then(ok => {
    if (!ok) notifyX11(session, x11Hint())
    else if (!session.x11Cookie && process.platform !== 'win32') notifyX11(session, x11CookieHint())
  }).catch(err => require('../common/log').warn('X11 probe failed', err))
}

// Prefer the configured display, then try the local display range supported
// by older bookmarks (some start their X server without exporting DISPLAY).
function * forwardingEndpoints (display) {
  const preferred = getX11Candidates(display)
  yield * preferred
  const tried = new Set(preferred.map(endpoint => endpoint.path ?? endpoint.port))
  if (process.platform !== 'win32' && !display?.includes('/')) {
    for (let n = 0; n <= 100; n++) {
      const path = `${unixSocketDir}/X${n}`
      if (!tried.has(path)) yield { path }
    }
  }
  for (let n = 0; n < 100; n++) {
    const port = defaultTcpPort + n
    if (!tried.has(port)) yield { port, host: '127.0.0.1' }
  }
}

function forwardX11Channel (session, sockets, accept, reject) {
  const endpoints = forwardingEndpoints(session.display)
  function tryNext () {
    const { done, value } = endpoints.next()
    if (done) {
      reject()
      notifyX11(session, `Could not reach a local X server (display: ${session.display || 'not set'}). ${x11Hint()}`)
      return
    }
    const local = net.connect(value)
    sockets.add(local)
    function failed () {
      local.removeListener('connect', connected)
      if (sockets.delete(local)) tryNext()
    }
    function connected () {
      if (!sockets.has(local)) return
      local.removeListener('error', failed)
      local.removeListener('close', failed)
      const remote = accept()
      const closeLocal = () => {
        if (sockets.delete(local)) local.destroy()
      }
      local.on('error', closeLocal)
      remote.on('error', closeLocal)
      remote.once('close', closeLocal)
      local.once('close', () => {
        sockets.delete(local)
        remote.removeListener('close', closeLocal)
        remote.destroy()
      })
      remote.pipe(local).pipe(remote)
    }
    local.once('error', failed)
    local.once('close', failed)
    local.once('connect', connected)
  }
  tryNext()
}

function enableX11Forwarding (session, conn) {
  // One SSH transport may carry many GUI windows at the same time.
  const sockets = new Set()
  const forward = (info, accept, reject) => forwardX11Channel(session, sockets, accept, reject)
  conn.on('x11', forward)
  conn.once('close', () => {
    conn.removeListener('x11', forward)
    for (const socket of sockets) {
      sockets.delete(socket)
      socket.destroy()
    }
  })
}

module.exports = {
  X11_HELP_URL,
  getX11Candidates,
  probeXServer,
  x11Hint,
  x11CookieHint,
  prepareX11,
  enableX11Forwarding
}
