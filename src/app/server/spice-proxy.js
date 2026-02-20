const net = require('net')
const log = require('../common/log')
const proxySock = require('./socks')

const LOG_PREFIX = '[SPICE-PROXY]'

async function createTcpConnection (host, port, options = {}) {
  const { proxy, readyTimeout = 15000 } = options

  if (proxy) {
    log.debug(`${LOG_PREFIX} Connecting through proxy: ${proxy}`)
    const proxyResult = await proxySock({
      readyTimeout,
      host,
      port,
      proxy
    })
    log.debug(`${LOG_PREFIX} Proxy connection established`)
    return proxyResult.socket
  }

  return new Promise((resolve, reject) => {
    const tcpSocket = net.createConnection({ host, port }, () => {
      log.debug(`${LOG_PREFIX} TCP connection established to ${host}:${port}`)
      resolve(tcpSocket)
    })
    tcpSocket.once('error', (err) => {
      reject(new Error(`TCP connection failed: ${err.message}`))
    })
    tcpSocket.setTimeout(readyTimeout, () => {
      tcpSocket.destroy()
      reject(new Error('Connection timed out'))
    })
  })
}

function setupRelay (ws, tcpSocket, logPrefix = LOG_PREFIX) {
  let wsClosed = false
  let tcpClosed = false

  const cleanup = (source) => {
    if (wsClosed && tcpClosed) return
    log.debug(`${logPrefix} Cleanup triggered by: ${source}`)
    wsClosed = true
    tcpClosed = true

    try {
      if (ws && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
    } catch (e) {
      log.debug(`${logPrefix} WebSocket close error:`, e.message)
    }

    try {
      tcpSocket.destroy()
    } catch (e) {
      log.debug(`${logPrefix} TCP socket destroy error:`, e.message)
    }
  }

  tcpSocket.on('data', (data) => {
    if (wsClosed) return
    try {
      ws.send(data)
    } catch (e) {
      log.error(`${logPrefix} WebSocket send error:`, e.message)
      cleanup('WebSocket send error')
    }
  })

  tcpSocket.on('close', () => cleanup('TCP close'))
  tcpSocket.on('end', () => cleanup('TCP end'))
  tcpSocket.on('error', (err) => {
    log.error(`${logPrefix} TCP error:`, err.message)
    cleanup('TCP error')
  })

  ws.on('message', (data) => {
    if (tcpClosed) return
    try {
      tcpSocket.write(data)
    } catch (e) {
      log.error(`${logPrefix} TCP write error:`, e.message)
      cleanup('TCP write error')
    }
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${logPrefix} WebSocket error:`, err.message)
    cleanup('WebSocket error')
  })
}

async function handleConnection (ws, options = {}) {
  log.debug(`${LOG_PREFIX} New WebSocket connection for SPICE proxy`)

  const { host, port, proxy, readyTimeout = 15000 } = options

  if (!host || !port) {
    log.error(`${LOG_PREFIX} Missing host or port`)
    ws.close()
    return
  }

  try {
    const tcpSocket = await createTcpConnection(host, port, { proxy, readyTimeout })
    log.debug(`${LOG_PREFIX} Connected to SPICE server at ${host}:${port}`)

    setupRelay(ws, tcpSocket)
  } catch (err) {
    log.error(`${LOG_PREFIX} Connection failed:`, err.message)
    try {
      ws.close()
    } catch (e) {}
  }
}

module.exports = {
  handleConnection,
  createTcpConnection,
  setupRelay
}
