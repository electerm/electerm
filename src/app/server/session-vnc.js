/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const net = require('net')
const proxySock = require('./socks')
const uid = require('../common/uid')
const { terminalSsh } = require('./session-ssh')
const globalState = require('./global-state')

function getPort (fromPort = 120023) {
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        resolve(freePort)
      }
    })
  })
}

class TerminalVnc extends TerminalBase {
  init = async () => {
    globalState.setSession(this.initOptions.sessionId, {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    })
    return Promise.resolve(this)
  }

  start = async (width, height) => {
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    if (this.channel) {
      this.channel.close()
      delete this.channel
    }
    const {
      host,
      port
    } = this.initOptions
    const info = await this.hop()
    const target = net.createConnection({
      port,
      host,
      ...info
    })
    this.channel = target
    target.on('data', this.onData)
    target.on('end', this.kill)
    target.on('error', this.onError)

    this.ws.on('message', this.onMsg)
    this.ws.on('close', this.kill)
    this.width = width
    this.height = height
  }

  hop = async () => {
    const {
      host,
      port,
      proxy,
      readyTimeout,
      connectionHoppings
    } = this.initOptions
    if (!connectionHoppings || !connectionHoppings.length) {
      return proxy
        ? await proxySock({
          readyTimeout,
          host,
          port,
          proxy
        })
        : undefined
    }
    const hop = connectionHoppings.pop()
    const fp = await getPort(12023)
    const initOpts = {
      connectionHoppings,
      ...hop,
      hasHopping: true,
      cols: 80,
      rows: 24,
      term: 'xterm-256color',
      saveTerminalLogToFile: false,
      id: uid(),
      enableSsh: true,
      encode: 'utf-8',
      envLang: 'en_US.UTF-8',
      proxy,
      sessionId: uid(),
      sshTunnels: [
        {
          sshTunnel: 'dynamicForward',
          sshTunnelLocalHost: '127.0.0.1',
          sshTunnelLocalPort: fp,
          id: uid()
        }
      ]
    }
    this.ssh = await terminalSsh(initOpts)
    const proxyA = `socks5://127.0.0.1:${fp}`
    return proxySock({
      readyTimeout,
      host,
      port,
      proxy: proxyA
    })
  }

  onMsg = (msg) => {
    this.channel.write(msg)
  }

  onData = (data) => {
    try {
      this.ws?.send(data)
    } catch (e) {
      log.error('vnc connection send data error', e)
    }
  }

  resize () {

  }

  onError = (err) => {
    log.error('vnc error', err)
    this.kill()
  }

  test = async () => {
    return new Promise((resolve, reject) => {
      const {
        host,
        port
      } = this.initOptions
      return this.hop()
        .then(info => {
          net.createConnection({
            port,
            host,
            ...info
          }, () => {
            resolve(true)
          })
        })
        .catch(err => reject(err))
    })
  }

  kill = () => {
    log.debug('Closed vnc session ' + this.pid)
    if (this.ws) {
      this.ws.close()
      delete this.ws
    }
    if (this.ssh) {
      this.ssh.kill()
      delete this.ssh
    }
    this.channel && this.channel.end()
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const inst = globalState.getSession(this.initOptions.sessionId)
    if (!inst) {
      return
    }
    delete inst.terminals[this.pid]
    if (
      _.isEmpty(inst.terminals)
    ) {
      globalState.removeSession(this.initOptions.sessionId)
    }
  }
}

exports.terminalVnc = async function (initOptions, ws) {
  const term = new TerminalVnc(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnectionVnc = (options) => {
  const inst = new TerminalVnc(options, undefined, true)
  return inst.test()
    .then(() => {
      inst.kill()
      return true
    })
    .catch(() => {
      inst.kill()
      return false
    })
}
