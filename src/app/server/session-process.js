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

async function createWs (port, ws, pid) {
  const WebSocket = require('ws')
  const { tokenElecterm } = process.env
  const wsUrl = `ws://127.0.0.1:${port}/common/s?token=${tokenElecterm}`
  console.log('WebSocket URL:', wsUrl)
  const socket = new WebSocket(wsUrl)

  socket.s = msg => {
    try {
      socket.send(JSON.stringify(msg))
    } catch (e) {
      console.error('ws send error')
      console.error(e)
    }
  }
  websockets.set(pid, socket)

  return new Promise((resolve, reject) => {
    socket.on('open', () => {
      resolve(socket)
    })
    socket.on('error', (err) => {
      console.error('WebSocket connection error:', err)
      reject(err)
    })
  })
}

function sendMsgToWs (socketOrPid, msg) {
  console.log('websockets',websockets.keys())
  console.log('sendMsgToWs', socketOrPid, msg)
  const socket = typeof socketOrPid === 'string'
    ? websockets.get(socketOrPid)
    : socketOrPid
  return new Promise((resolve, reject) => {
    const onMsg = (data) => {
      try {
        const response = JSON.parse(data)
        console.log('9999WebSocket response received:', response)
        if (response.id !== msg.id) {
          console.log('99999WebSocket response received for different message id:', response.id, '!=', msg.id)
          return
        }
        if (response.error) {
          console.error('Error in WebSocket response:', response.error)
          return reject(response.error)
        }
        console.log('Parsed response data:', response.data)
        resolve(response.data)
      } catch (err) {
        console.error('Error parsing WebSocket response:', err)
        reject(new Error('Invalid response format'))
      }
    }
    socket.on('message', onMsg)
    socket.s(msg)
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
  const socket = await createWs(port, ws, pid)
  await sendMsgToWs(socket, {
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
  const pid = initOptions.uid
  const socket = await createWs(port, ws, pid)
  const res = await sendMsgToWs(socket, {
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
      return sendMsgToWs(pid, {
        id,
        action: 'run-cmd',
        body: { cmd, pid }
      })
    },
    resize: (cols, rows, id) => {
      console.log(`Resizing terminal ${pid} to ${cols}x${rows}`)
      sendMsgToWs(pid, {
        id,
        action: 'resize-terminal',
        body: { cols, rows, pid }
      }).catch((err) => {
        console.error('Error resizing terminal:', err)
      }) // Ignore errors for resize
    },
    toggleTerminalLog: (id) => {
      console.log(`Toggling terminal log for ${pid}`)
      sendMsgToWs(pid, {
        id,
        action: 'toggle-terminal-log',
        body: { pid }
      }).catch((err) => {
        console.error('Error toggling terminal log:', err)
      })
    },
    toggleTerminalLogTimestamp: (id) => {
      console.log(`Toggling terminal log timestamp for ${pid}`)
      sendMsgToWs(pid, {
        id,
        action: 'toggle-terminal-log-timestamp',
        body: { pid }
      }).catch((err) => {
        console.error('Error toggling terminal log timestamp:', err)
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
