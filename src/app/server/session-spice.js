const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const { handleConnection } = require('./spice-proxy')

class TerminalSpice extends TerminalBase {
  channelCounter = 0

  init = async () => {
    this.wsMap = new Map()
    globalState.setSession(this.pid, this)
    return Promise.resolve(this)
  }

  start = async (query = {}, ws) => {
    if (!ws) {
      log.error(`[SPICE:${this.pid}] No WebSocket provided`)
      return
    }

    const {
      host,
      port = 5900,
      proxy,
      readyTimeout = 10000
    } = this.initOptions

    this.channelCounter++
    const connId = `${this.channelCounter}`
    this.wsMap.set(connId, ws)

    log.debug(`[SPICE:${this.pid}] Starting SPICE channel #${connId} to ${host}:${port}, total channels: ${this.wsMap.size}`)

    const cleanup = () => {
      this.wsMap.delete(connId)
      log.debug(`[SPICE:${this.pid}] Channel #${connId} closed, remaining: ${this.wsMap.size}`)
      if (this.wsMap.size === 0) {
        this.kill()
      }
    }

    handleConnection(ws, {
      host,
      port,
      proxy,
      readyTimeout,
      onCleanup: cleanup,
      channelId: `#${connId}`
    })
  }

  resize = () => {
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
    log.debug('Closed SPICE session ' + this.pid + ', remaining connections: ' + this.wsMap.size)
    for (const ws of this.wsMap.values()) {
      try {
        ws.close()
      } catch (e) {
        log.debug(`[SPICE:${this.pid}] ws.close() error:`, e.message)
      }
    }
    this.wsMap.clear()
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
