const { fork } = require('child_process')
const path = require('path')

// Map to store active terminal processes (pid -> {child, port, ws})
const activeTerminals = new Map()
const websockets = new Map()

function getPort (fromPort = 30975) {
  console.log('Getting free port starting from:', fromPort)
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        console.error('Error finding free port:', err)
        reject(err)
      } else {
        console.log('Found free port:', freePort)
        resolve(freePort)
      }
    })
  })
}

async function runSessionServer (type, port) {
  console.log(`Starting session server of type "${type}" on port ${port}`)
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
      console.log('Received message from child process:', m)
      if (m && m.serverInited) {
        console.log('Session server initialized successfully')
        resolve(child)
      }
    })
  })
}

async function sendMsgToChildProcess (pid, msg) {
  console.log('Sending message to child process:', pid, msg)
  const child = typeof pid === 'object' ? pid : activeTerminals.get(pid)?.child
  if (!child) {
    console.error('No terminal found for PID:', pid)
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
  console.log('Creating terminal with options:', initOptions)
  const type = initOptions.termType || initOptions.type || 'terminal'
  console.log('Terminal type:', type)
  const port = await getPort()
  console.log('Using port for terminal:', port)
  const child = await runSessionServer(type, port)
  console.log('Session server started with child process:', child.pid)

  console.log('Sending create-terminal message to WebSocket')
  const pid = initOptions.uid

  await sendMsgToChildProcess(child, {
    id: uid,
    action: 'create-terminal',
    body: initOptions
  })

  // Store the terminal process in the map
  activeTerminals.set(pid, {
    child,
    port,
    ws
  })
  console.log('Terminal added to activeTerminals pid', pid)

  return {
    pid,
    port
  }
}

exports.testConnection = async function (initOptions, ws, uid) {
  console.log('Testing connection with options:', initOptions)
  const type = initOptions.termType || initOptions.type || 'terminal'
  console.log('Connection type:', type)
  const port = await getPort()
  console.log('Using port for test connection:', port)
  const child = await runSessionServer(type, port)
  console.log('Session server started for test with child process:', child.pid)

  console.log('Sending test-terminal message to WebSocket')
  const res = await sendMsgToChildProcess(child, {
    id: uid,
    action: 'test-terminal',
    body: initOptions
  })
  console.log('Test connection result:', res)

  console.log('Killing test session server')
  child.kill()
  return res
}

/**
 * Get terminal instance by pid
 * @param {string} pid - Process ID of the terminal
 * @returns {object|null} Terminal instance or null if not found
 */
exports.terminals = function (pid) {
  console.log('Getting terminal instance for PID:', pid)
  const terminal = activeTerminals.get(pid)
  if (!terminal) {
    console.log('No terminal found for PID:', pid)
    return null
  }
  console.log('Found terminal for PID:', pid)

  return {
    runCmd: async (cmd, id) => {
      console.log(`Running command in terminal ${pid}:`, cmd)
      return sendMsgToChildProcess(pid, {
        id,
        action: 'run-cmd',
        body: { cmd, pid }
      })
    },
    resize: (cols, rows, id) => {
      console.log(`Resizing terminal ${pid} to ${cols}x${rows}`)
      sendMsgToChildProcess(pid, {
        id,
        action: 'resize-terminal',
        body: { cols, rows, pid }
      })// Ignore errors for resize
    },
    toggleTerminalLog: (id) => {
      console.log(`Toggling terminal log for ${pid}`)
      sendMsgToChildProcess(pid, {
        id,
        action: 'toggle-terminal-log',
        body: { pid }
      })
    },
    toggleTerminalLogTimestamp: (id) => {
      console.log(`Toggling terminal log timestamp for ${pid}`)
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
  console.log('Cleaning up all active terminals')
  for (const [pid, terminal] of activeTerminals) {
    console.log(`Killing terminal process ${pid}`)
    terminal.child.kill()
    activeTerminals.delete(pid)
  }
  for (const [pid, socket] of websockets) {
    console.log(`Closing WebSocket for terminal ${pid}`)
    socket.close()
    websockets.delete(pid)
  }
  console.log('All terminals cleaned up')
}

// Clean up on process exit
process.on('exit', () => {
  console.log('Process exit detected, cleaning up terminals')
  exports.cleanupTerminals()
})
process.on('SIGINT', () => {
  console.log('SIGINT detected, cleaning up terminals')
  exports.cleanupTerminals()
})
process.on('SIGTERM', () => {
  console.log('SIGTERM detected, cleaning up terminals')
  exports.cleanupTerminals()
})
