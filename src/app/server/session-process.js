const { fork } = require('child_process')
const path = require('path')

// Map to store active terminal processes (pid -> {child, port, ws})
const activeTerminals = new Map()

// Track the last port assigned
let lastPort = 30975
const MIN_PORT = 30975
const MAX_PORT = 65534

function getPort (fromPort = MIN_PORT) {
  // Use the last port + 1 or start over if we've reached MAX_PORT
  const startPort = lastPort >= MAX_PORT ? MIN_PORT : lastPort + 1

  return new Promise((resolve, reject) => {
    require('find-free-port')(startPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        // Remember this port for next time
        lastPort = freePort
        resolve(freePort)
      }
    })
  })
}

async function runSessionServer (type, port) {
  return new Promise((resolve) => {
    const child = fork(path.resolve(__dirname, './session-server.js'), {
      env: Object.assign(
        {
          wsPort: port,
          type
        },
        process.env
      ),
      cwd: process.cwd()
    }, (error, stdout, stderr) => {
      if (error || stderr) {
        console.error('Error in session server:', error || stderr)
        throw error || stderr
      }
    })
    child.on('message', (m) => {
      if (m && m.serverInited) {
        resolve(child)
      }
    })
  })
}

async function sendMsgToChildProcess (pid, msg) {
  const child = typeof pid === 'object' ? pid : activeTerminals.get(pid)?.child
  if (!child) {
    throw new Error(`Terminal with PID ${pid} not found`)
  }

  return new Promise((resolve, reject) => {
    const responseHandler = (response) => {
      if (response.id === msg.id) {
        child.removeListener('message', responseHandler)
        if (response.error) {
          reject(response.error)
        } else {
          resolve(response.data)
        }
      }
    }

    child.on('message', responseHandler)
    child.send({
      type: 'common',
      data: msg
    })
  })
}

exports.terminal = async function (initOptions, ws, uid) {
  const type = initOptions.termType || initOptions.type || 'terminal'
  const port = await getPort()
  const child = await runSessionServer(type, port)
  const pid = initOptions.uid

  child.on('message', (m) => {
    const { type, data } = m
    if (type === 'common') {
      ws.s(data)
      ws.once((data) => {
        child.send(data)
      }, data.id)
    }
  })

  child.on('exit', () => {
    activeTerminals.delete(pid)
  })

  if (initOptions.termType !== 'ftp') {
    await sendMsgToChildProcess(child, {
      id: uid,
      action: 'create-terminal',
      body: initOptions
    })
  }

  // Store the terminal process in the map
  activeTerminals.set(pid, {
    child,
    port,
    ws
  })

  return {
    pid,
    port
  }
}

exports.testConnection = async function (initOptions, ws, uid) {
  const type = initOptions.termType || initOptions.type || 'terminal'
  const port = await getPort()
  const child = await runSessionServer(type, port)

  const res = await sendMsgToChildProcess(child, {
    id: uid,
    action: 'test-terminal',
    body: initOptions
  })

  child.kill()
  return res
}

/**
 * Get terminal instance by pid
 * @param {string} pid - Process ID of the terminal
 * @returns {object|null} Terminal instance or null if not found
 */
exports.terminals = function (pid) {
  const terminal = activeTerminals.get(pid)
  if (!terminal) {
    return null
  }

  return {
    runCmd: async (cmd, id) => {
      return sendMsgToChildProcess(pid, {
        id,
        action: 'run-cmd',
        body: { cmd, pid }
      })
    },
    resize: (cols, rows, id) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'resize-terminal',
        body: { cols, rows, pid }
      })// Ignore errors for resize
    },
    toggleTerminalLog: (id) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'toggle-terminal-log',
        body: { pid }
      })
    },
    toggleTerminalLogTimestamp: (id) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'toggle-terminal-log-timestamp',
        body: { pid }
      })
    }
  }
}

/**
 * Clean up all active terminals
 */
exports.cleanupTerminals = function () {
  for (const [pid, terminal] of activeTerminals) {
    terminal.child.kill()
    activeTerminals.delete(pid)
  }
}

// Clean up on process exit
process.on('exit', () => {
  exports.cleanupTerminals()
})
process.on('SIGINT', () => {
  exports.cleanupTerminals()
})
process.on('SIGTERM', () => {
  exports.cleanupTerminals()
})
