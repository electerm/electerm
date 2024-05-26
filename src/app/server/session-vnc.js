/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const { TerminalBase } = require('./session-base')
const net = require('net')

class TerminalVnc extends TerminalBase {
  init = async () => {
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      terminals: {
        [this.pid]: this
      }
    }
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
    const target = net.createConnection(port, host, this.onConnect)
    this.channel = target
    target.on('data', this.onData)
    target.on('end', function () {
      log.log('target disconnected')
    })
    target.on('error', this.onError)

    this.ws.on('message', this.onMsg)
    this.ws.on('close', this.kill)
    this.width = width
    this.height = height
  }

  onMsg = (msg) => {
    this.channel.write(msg)
  }

  onData = (data) => {
    try {
      this.ws?.send(data)
    } catch (e) {
      log.error('Client closed, cleaning up target', e)
    }
  }

  resize () {

  }

  onError = (err) => {
    log.error('vnc error', err)
    this.kill()
  }

  test = async () => {
    return Promise.resolve(true)
  }

  kill = () => {
    log.debug('Closed vnc session ' + this.pid)
    if (this.ws) {
      this.ws.close()
      delete this.ws
    }
    this.channel && this.channel.end()
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const inst = global.sessions[
      this.initOptions.sessionId
    ]
    if (!inst) {
      return
    }
    delete inst.terminals[this.pid]
    if (
      _.isEmpty(inst.terminals)
    ) {
      delete global.sessions[
        this.initOptions.sessionId
      ]
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
  return (new TerminalVnc(options, undefined, true))
    .test()
    .then(() => {
      return true
    })
    .catch(() => {
      return false
    })
}
