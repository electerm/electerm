/**
 * Single instance lock with socket-based IPC fallback
 * for Electron versions where additionalData doesn't work (e.g., Electron 22)
 */

const net = require('net')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const globalState = require('./glob-state')

// Get socket path based on platform
function getSocketPath () {
  const appName = app.getName()
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\${appName}-instance-lock`
  }
  // Unix socket
  const tmpDir = app.getPath('temp')
  return path.join(tmpDir, `${appName}-instance.sock`)
}

const socketPath = getSocketPath()

// Clean up stale socket file on Unix
function cleanupSocket () {
  if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
    try {
      fs.unlinkSync(socketPath)
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Start socket server to receive data from second instances
 * @param {Function} onSecondInstance - Callback when second instance sends data
 */
function startSocketServer (onSecondInstance) {
  cleanupSocket()

  const server = net.createServer((socket) => {
    let data = ''
    socket.on('data', (chunk) => {
      data += chunk.toString()
    })
    socket.on('end', () => {
      try {
        const parsed = JSON.parse(data)
        onSecondInstance(parsed)
      } catch (e) {
        console.error('Failed to parse second instance data:', e)
      }
    })
  })

  server.on('error', (err) => {
    console.error('Socket server error:', err)
  })

  server.listen(socketPath)

  // Clean up on app quit
  app.on('will-quit', () => {
    server.close()
    cleanupSocket()
  })

  return server
}

/**
 * Send data to primary instance via socket
 * @param {Object} data - Data to send
 * @returns {Promise<boolean>} - True if sent successfully
 */
function sendToFirstInstance (data) {
  return new Promise((resolve) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(data))
      client.end()
    })

    client.on('error', () => {
      // No server listening, we are the first instance
      resolve(false)
    })

    client.on('close', () => {
      resolve(true)
    })
  })
}

/**
 * Handle second instance connection with socket fallback
 * @param {Object} progs - Parsed command line options
 * @returns {Promise<boolean>} - True if this is the primary instance
 */
async function handleSingleInstance (progs) {
  // Try to send to existing instance first via socket
  const sent = await sendToFirstInstance(progs)
  if (sent) {
    // Successfully sent to primary instance, quit this one
    return false
  }

  // We are the primary instance, start socket server
  startSocketServer((data) => {
    const win = globalState.get('win')
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
      win.webContents.send('add-tab-from-command-line', data)
    }
  })

  return true
}

module.exports = {
  handleSingleInstance,
  sendToFirstInstance,
  startSocketServer
}
