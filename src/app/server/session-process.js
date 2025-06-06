const { fork } = require('child_process')
const path = require('path')

// Map to store active terminal processes (pid -> {child, port, ws})
const activeTerminals = new Map()

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

/**
 * Send a message to a WebSocket server and get the response
 * @param {number} port - Port number of the WebSocket server
 * @param {object} msg - Message to send
 * @returns {Promise<any>} - Response data or error
 */
function sendMsgToWs (port, msg) {
  console.log(`Sending message to WebSocket on port ${port}:`, msg)
  const WebSocket = require('ws')
  const { tokenElecterm } = process.env
  const wsUrl = `ws://127.0.0.1:${port}/common/s?token=${tokenElecterm}`
  console.log('WebSocket URL:', wsUrl)
  const socket = new WebSocket(wsUrl)

  return new Promise((resolve, reject) => {
    socket.on('open', () => {
      console.log('WebSocket connection opened')
      socket.send(JSON.stringify(msg))
      console.log('Message sent to WebSocket')

      socket.on('message', (data) => {
        console.log('Received response from WebSocket:', data.toString())
        try {
          const response = JSON.parse(data)
          if (response.error) {
            console.error('Error in WebSocket response:', response.error)
            socket.close()
            return reject(response.error)
          }
          console.log('Parsed response data:', response.data)
          socket.close()
          resolve(response.data)
        } catch (err) {
          console.error('Error parsing WebSocket response:', err)
          socket.close()
          reject(new Error('Invalid response format'))
        }
      })
    })

    socket.on('error', (err) => {
      console.error('WebSocket connection error:', err)
      reject(err)
    })
  })
}

exports.terminal = async function (initOptions, ws) {
  console.log('Creating terminal with options:', initOptions)
  const type = initOptions.termType || initOptions.type || 'terminal'
  console.log('Terminal type:', type)
  const port = await getPort()
  console.log('Using port for terminal:', port)
  const child = await runSessionServer(type, port)
  console.log('Session server started with child process:', child.pid)

  console.log('Sending create-terminal message to WebSocket')
  const pid = await sendMsgToWs(port, {
    action: 'create-terminal',
    body: initOptions
  })
  console.log('Terminal created with PID:', pid)

  // Store the terminal process in the map
  activeTerminals.set(pid, {
    child,
    port,
    ws
  })
  console.log('Terminal added to activeTerminals map')

  return {
    pid,
    port
  }
}

exports.testConnection = async function (initOptions) {
  console.log('Testing connection with options:', initOptions)
  const type = initOptions.termType || initOptions.type || 'terminal'
  console.log('Connection type:', type)
  const port = await getPort()
  console.log('Using port for test connection:', port)
  const child = await runSessionServer(type, port)
  console.log('Session server started for test with child process:', child.pid)

  console.log('Sending test-terminal message to WebSocket')
  const res = await sendMsgToWs(port, {
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
    runCmd: async (cmd) => {
      console.log(`Running command in terminal ${pid}:`, cmd)
      return sendMsgToWs(terminal.port, {
        action: 'run-cmd',
        body: { cmd }
      })
    },
    resize: (cols, rows) => {
      console.log(`Resizing terminal ${pid} to ${cols}x${rows}`)
      sendMsgToWs(terminal.port, {
        action: 'resize-terminal',
        body: { cols, rows }
      }).catch((err) => {
        console.error('Error resizing terminal:', err)
      }) // Ignore errors for resize
    },
    toggleTerminalLog: () => {
      console.log(`Toggling terminal log for ${pid}`)
      sendMsgToWs(terminal.port, {
        action: 'toggle-terminal-log',
        body: {}
      }).catch((err) => {
        console.error('Error toggling terminal log:', err)
      })
    },
    toggleTerminalLogTimestamp: () => {
      console.log(`Toggling terminal log timestamp for ${pid}`)
      sendMsgToWs(terminal.port, {
        action: 'toggle-terminal-log-timestamp',
        body: {}
      }).catch((err) => {
        console.error('Error toggling terminal log timestamp:', err)
      })
    },
    destroy: () => {
      console.log(`Destroying terminal ${pid}`)
      terminal.child.kill()
      activeTerminals.delete(pid)
      console.log(`Terminal ${pid} destroyed`)
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
