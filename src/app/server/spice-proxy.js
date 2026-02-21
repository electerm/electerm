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
      tcpSocket.setKeepAlive(true, 5000)
      tcpSocket.setTimeout(0)
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

async function handleConnection (ws, options = {}) {
  const { host, port, proxy, readyTimeout = 15000, onCleanup, channelId } = options
  const id = channelId || 'unknown'

  log.debug(`${LOG_PREFIX}[${id}] New WebSocket connection for SPICE proxy`)

  if (!host || !port) {
    log.error(`${LOG_PREFIX}[${id}] Missing host or port`)
    ws.close()
    if (onCleanup) onCleanup()
    return
  }

  const messageBuffer = []
  let wsClosed = false
  let tcpClosed = false
  let tcpSocket = null

  const cleanup = (source) => {
    if (wsClosed && tcpClosed) return
    log.debug(`${LOG_PREFIX}[${id}] Cleanup triggered by: ${source}`)
    wsClosed = true
    tcpClosed = true

    try {
      if (ws && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] WebSocket close error:`, e.message)
    }

    try {
      if (tcpSocket) {
        tcpSocket.destroy()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] TCP socket destroy error:`, e.message)
    }

    if (onCleanup) {
      onCleanup()
    }
  }

  ws.on('message', (data) => {
    if (tcpClosed) return
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)

    if (tcpSocket) {
      try {
        tcpSocket.write(buf)
      } catch (e) {
        log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
        cleanup('TCP write error')
      }
    } else {
      messageBuffer.push(buf)
    }
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] WebSocket error:`, err.message)
    cleanup('WebSocket error')
  })

  try {
    tcpSocket = await createTcpConnection(host, port, { proxy, readyTimeout })
    log.debug(`${LOG_PREFIX}[${id}] Connected to SPICE server at ${host}:${port}`)

    tcpSocket.on('data', (data) => {
      if (wsClosed) return
      try {
        ws.send(data)
      } catch (e) {
        log.error(`${LOG_PREFIX}[${id}] WebSocket send error:`, e.message)
        cleanup('WebSocket send error')
      }
    })

    tcpSocket.on('close', () => cleanup('TCP close'))
    tcpSocket.on('end', () => cleanup('TCP end'))
    tcpSocket.on('error', (err) => {
      log.error(`${LOG_PREFIX}[${id}] TCP error:`, err.message)
      cleanup('TCP error')
    })

    if (messageBuffer.length > 0) {
      for (const buf of messageBuffer) {
        try {
          tcpSocket.write(buf)
        } catch (e) {
          log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
          cleanup('TCP write error')
          return
        }
      }
      messageBuffer.length = 0
    }
  } catch (err) {
    log.error(`${LOG_PREFIX}[${id}] Connection failed:`, err.message)
    try {
      ws.close()
    } catch (e) {}
    if (onCleanup) onCleanup()
  }
}

function setupRelay (ws, tcpSocket, options = {}) {
  const { onCleanup, channelId } = options
  let wsClosed = false
  let tcpClosed = false
  const id = channelId || 'unknown'

  const cleanup = (source) => {
    if (wsClosed && tcpClosed) return
    log.debug(`${LOG_PREFIX}[${id}] Cleanup triggered by: ${source}`)
    wsClosed = true
    tcpClosed = true

    try {
      if (ws && ws.readyState !== ws.CLOSED) {
        ws.close()
      }
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] WebSocket close error:`, e.message)
    }

    try {
      tcpSocket.destroy()
    } catch (e) {
      log.debug(`${LOG_PREFIX}[${id}] TCP socket destroy error:`, e.message)
    }

    if (onCleanup) {
      onCleanup()
    }
  }

  tcpSocket.on('data', (data) => {
    if (wsClosed) return
    try {
      ws.send(data)
    } catch (e) {
      log.error(`${LOG_PREFIX}[${id}] WebSocket send error:`, e.message)
      cleanup('WebSocket send error')
    }
  })

  tcpSocket.on('close', () => cleanup('TCP close'))
  tcpSocket.on('end', () => cleanup('TCP end'))
  tcpSocket.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] TCP error:`, err.message)
    cleanup('TCP error')
  })

  ws.on('message', (data) => {
    if (tcpClosed) return
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    try {
      tcpSocket.write(buf)
    } catch (e) {
      log.error(`${LOG_PREFIX}[${id}] TCP write error:`, e.message)
      cleanup('TCP write error')
    }
  })

  ws.on('close', () => cleanup('WebSocket'))
  ws.on('error', (err) => {
    log.error(`${LOG_PREFIX}[${id}] WebSocket error:`, err.message)
    cleanup('WebSocket error')
  })
}

module.exports = {
  handleConnection,
  createTcpConnection,
  setupRelay
}
