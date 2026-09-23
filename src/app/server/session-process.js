const { fork } = require('child_process')
const path = require('path')

// Map to store active terminal processes (pid -> {child, port, ws})
const activeTerminals = new Map()

// Track the last port assigned
let lastPort = 30975
const MIN_PORT = 30975
const MAX_PORT = 65534
// Add a set to track ports that are currently being assigned
const pendingPorts = new Set()

function getPort (fromPort = MIN_PORT) {
  // Use the last port + 1 or start over if we've reached MAX_PORT
  let startPort = lastPort >= MAX_PORT ? MIN_PORT : lastPort + 1

  // Skip ports that are currently being assigned
  while (pendingPorts.has(startPort)) {
    startPort = startPort >= MAX_PORT ? MIN_PORT : startPort + 1
  }

  // Mark this port as pending
  pendingPorts.add(startPort)

  return new Promise((resolve, reject) => {
    require('find-free-port')(startPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        // Remove from pending set on error
        pendingPorts.delete(startPort)
        reject(err)
      } else {
        // Remember this port for next time
        lastPort = freePort
        // Remove from pending set when done
        pendingPorts.delete(startPort)
        resolve(freePort)
      }
    })
  })
}

async function runSessionServer (type, port) {
  return new Promise((resolve) => {
    const cleanEnv = Object.assign({}, process.env)
    delete cleanEnv.ELECTRON_RUN_AS_NODE
    const child = fork(path.resolve(__dirname, './session-server.js'), {
      env: Object.assign(
        {
          wsPort: port,
          type
        },
        cleanEnv
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

async function sendMsgToChildProcess (pid, msg, timeoutMs = 0) {
  const child = typeof pid === 'object' ? pid : activeTerminals.get(pid)?.child
  if (!child) {
    throw new Error(`Terminal with PID ${pid} not found`)
  }

  return new Promise((resolve, reject) => {
    let timer = null
    let settled = false
    const entry = { id: msg.id, settle: null }
    const cleanup = () => {
      child.removeListener('message', responseHandler)
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      const pending = pendingChildRequests.get(child)
      if (pending) {
        pending.delete(entry)
        if (!pending.size) {
          pendingChildRequests.delete(child)
        }
      }
    }
    const doReject = (err) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(err)
    }
    entry.settle = doReject
    const responseHandler = (response) => {
      if (response && response.id === msg.id) {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        if (response.error) {
          reject(response.error)
        } else {
          resolve(response.data)
        }
      }
    }

    // Track pending requests per child so a child exit settles them
    // instead of leaving callers hanging forever (see onChildExit).
    let pending = pendingChildRequests.get(child)
    if (!pending) {
      pending = new Set()
      pendingChildRequests.set(child, pending)
    }
    pending.add(entry)

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        doReject(new Error(`Session request "${msg.action}" timed out after ${timeoutMs}ms (session may be dead)`))
      }, timeoutMs)
      if (timer.unref) {
        timer.unref()
      }
    }

    child.on('message', responseHandler)
    try {
      child.send({
        type: 'common',
        data: msg
      })
    } catch (err) {
      doReject(err)
    }
  })
}

// Pending sendMsgToChildProcess entries, keyed by child process.
// A child can die (crash on connection loss, cleanup on disconnect)
// while requests are in flight — reject them instead of hanging.
const pendingChildRequests = new Map()

function onChildExit (child) {
  // Settle in-flight requests first: removing listeners without settling
  // used to leave callers (exec-cmd, run-cmd) hanging forever.
  const pending = pendingChildRequests.get(child)
  if (pending) {
    pendingChildRequests.delete(child)
    for (const entry of pending) {
      try {
        entry.settle(new Error('Session process exited before responding'))
      } catch (_) {
        // ignore settle errors during teardown
      }
    }
  }
  // Remove all pending message listeners to prevent memory leaks
  // if the child exits before responding to sendMsgToChildProcess calls
  child.removeAllListeners('message')
}

exports.terminal = async function (initOptions, ws, uid) {
  const type = initOptions.termType || initOptions.type || 'terminal'
  const port = await getPort()
  const child = await runSessionServer(type, port)
  const pid = initOptions.uid
  const isSsh = ![
    'telnet',
    'serial',
    'local',
    'rdp',
    'vnc',
    'spice',
    'ftp'
  ].includes(type)
  if (isSsh) {
    child.on('message', (m) => {
      const { type, data } = m
      if (type === 'common') {
        ws.s(data)
        ws.once((data) => {
          child.send(data)
        }, data.id)
      }
    })
  }
  child.on('exit', () => {
    onChildExit(child)
    activeTerminals.delete(pid)
  })
  if (type !== 'ftp') {
    try {
      await sendMsgToChildProcess(child, {
        id: uid,
        action: 'create-terminal',
        body: initOptions
      })
    } catch (err) {
      child.kill()
      throw err
    }
  }

  // Kill any existing child process for this pid before overwriting.
  // This can happen on reconnects where a new process is spawned for the same tab id.
  const existingEntry = activeTerminals.get(pid)
  if (existingEntry) {
    existingEntry.child.kill()
    activeTerminals.delete(pid)
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

  const isSsh = ![
    'telnet',
    'serial',
    'local',
    'rdp',
    'vnc',
    'spice',
    'ftp'
  ].includes(type)
  if (isSsh && ws) {
    child.on('message', (m) => {
      const { type: msgType, data } = m
      if (msgType === 'common') {
        ws.s(data)
        ws.once((respData) => {
          child.send(respData)
        }, data.id)
      }
    })
  }

  const res = await sendMsgToChildProcess(child, {
    id: uid,
    action: 'test-terminal',
    body: initOptions
  }, 60000)

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
    execCommand: async (cmd, timeoutMs, id) => {
      // Parent-side backstop: the child bounds the command itself with
      // timeoutMs, so allow it plus a margin for IPC round-trips.
      const parentTimeout = (Number(timeoutMs) > 0 ? Number(timeoutMs) : 120000) + 30000
      return sendMsgToChildProcess(pid, {
        id,
        action: 'exec-cmd',
        body: { cmd, pid, timeoutMs }
      }, parentTimeout)
    },
    resize: (cols, rows, id) => {
      // Fire-and-forget, but bound the pending IPC listener with a timeout
      // so a slow/dead child can not accumulate 'message' handlers on resize
      // floods (fit sends resize on every layout change).
      sendMsgToChildProcess(pid, {
        id,
        action: 'resize-terminal',
        body: { cols, rows, pid }
      }, 10000).catch(() => {})// Ignore errors for resize
    },
    toggleTerminalLog: (id) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'toggle-terminal-log',
        body: { pid }
      }, 10000).catch(() => {})
    },
    toggleTerminalLogTimestamp: (id) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'toggle-terminal-log-timestamp',
        body: { pid }
      }, 10000).catch(() => {})
    },
    setTerminalLogPath: (id, logPath) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'set-terminal-log-path',
        body: { pid, logPath }
      }, 10000).catch(() => {})
    },
    startTerminalLogFile: (id, logFilePath, addTimeStampToTermLog) => {
      sendMsgToChildProcess(pid, {
        id,
        action: 'start-terminal-log-file',
        body: { pid, logFilePath, addTimeStampToTermLog }
      }, 10000).catch(() => {})
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
process.on('SIGINT', () => {
  exports.cleanupTerminals()
  process.exit()
})
process.on('SIGTERM', () => {
  exports.cleanupTerminals()
  process.exit()
})
