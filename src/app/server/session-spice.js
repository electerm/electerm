const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const { handleConnection } = require('./spice-proxy')

class TerminalSpice extends TerminalBase {
  init = async () => {
    globalState.setSession(this.pid, this)
    return Promise.resolve(this)
  }

  start = async (query = {}) => {
    if (!this.ws) {
      log.error(`[SPICE:${this.pid}] No WebSocket available`)
      return
    }

    const {
      host,
      port = 5900,
      proxy,
      readyTimeout = 10000
    } = this.initOptions

    log.debug(`[SPICE:${this.pid}] Starting SPICE session to ${host}:${port}`)

    handleConnection(this.ws, {
      host,
      port,
      proxy,
      readyTimeout
    })
  }

  resize = () => {
    // SPICE handles resize via the client
  }

  test = async () => {
    const net = require('net')
    const proxySock = require('./socks')
    const {
      host,
      port = 5900,
      proxy,
      readyTimeout = 10000
    } = this.initOptions

    if (proxy) {
      const proxyResult = await proxySock({
        readyTimeout,
        host,
        port,
        proxy
      })
      const socket = proxyResult.socket
      socket.destroy()
      return true
    }

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('error', (err) => {
        reject(err)
      })
      socket.setTimeout(readyTimeout, () => {
        socket.destroy()
        reject(new Error('Connection timed out'))
      })
    })
  }

  kill = () => {
    log.debug('Closed SPICE session ' + this.pid)
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        log.debug(`[SPICE:${this.pid}] ws.close() error:`, e.message)
      }
      delete this.ws
    }
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const { pid } = this
    const inst = globalState.getSession(pid)
    if (!inst) {
      return
    }
    globalState.removeSession(pid)
  }
}

exports.session = async function (initOptions, ws) {
  const term = new TerminalSpice(initOptions, ws)
  await term.init()
  return term
}

exports.test = (options) => {
  return (new TerminalSpice(options, undefined, true))
    .test()
    .then(() => {
      return true
    })
    .catch(() => {
      return false
    })
}
