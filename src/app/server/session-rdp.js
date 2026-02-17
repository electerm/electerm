/**
 * RDP session using IronRDP WASM + RDCleanPath proxy
 *
 * Architecture:
 *   Browser (IronRDP WASM) <--WebSocket--> This Proxy <--TLS--> RDP Server
 *
 * The WASM client handles all RDP protocol logic.
 * This server-side code acts as a RDCleanPath proxy:
 *   1. Receives RDCleanPath Request from WASM client (ASN.1 DER binary)
 *   2. TCP connects to the RDP server (optionally through proxy)
 *   3. Performs X.224 handshake + TLS upgrade
 *   4. Sends RDCleanPath Response (with certs) back to WASM client
 *   5. Bidirectional relay: WebSocket <-> TLS
 */
const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const {
  handleConnection
} = require('./rdp-proxy')

class TerminalRdp extends TerminalBase {
  init = async () => {
    globalState.setSession(this.pid, this)
    return Promise.resolve(this)
  }

  /**
   * Start the RDCleanPath proxy for this session.
   * Called when the WebSocket connects from the browser.
   * The WASM client will send an RDCleanPath Request as the first message.
   */
  start = async (width, height) => {
    if (!this.ws) {
      log.error(`[RDP:${this.pid}] No WebSocket available`)
      return
    }
    this.width = width
    this.height = height

    const {
      proxy,
      readyTimeout
    } = this.initOptions

    handleConnection(this.ws, {
      proxy,
      readyTimeout
    })
  }

  resize () {
    // IronRDP handles resize via the WASM session.resize() method
    // which sends resize PDUs through the existing relay
  }

  test = async () => {
    const net = require('net')
    const proxySock = require('./socks')
    const {
      host,
      port = 3389,
      proxy,
      readyTimeout = 10000
    } = this.initOptions

    if (proxy) {
      // Test connection through proxy
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

    // Direct connection test
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
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        log.debug(`[RDP:${this.pid}] ws.close() error: ${e.message}`)
      }
      delete this.ws
    }
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const {
      pid
    } = this
    const inst = globalState.getSession(pid)
    if (!inst) {
      return
    }
    globalState.removeSession(pid)
  }
}

exports.session = async function (initOptions, ws) {
  const term = new TerminalRdp(initOptions, ws)
  await term.init()
  return term
}

/**
 * test RDP connection (TCP connectivity check)
 * @param {object} options
 */
exports.test = (options) => {
  return (new TerminalRdp(options, undefined, true))
    .test()
    .then(() => {
      return true
    })
    .catch(() => {
      return false
    })
}
