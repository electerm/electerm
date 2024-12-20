/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const { Telnet } = require('./telnet')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalTelnet extends TerminalBase {
  init = async () => {
    const connection = new Telnet()

    const { initOptions } = this
    const shellOpts = {
      highWaterMark: 64 * 1024 * 16
    }
    const params = _.pick(
      initOptions,
      [
        'host',
        'port',
        'timeout',
        'username',
        'password',
        'terminalWidth',
        'terminalHeight'
      ]
    )
    Object.assign(
      params,
      {
        negotiationMandatory: false,
        // terminalWidth: initOptions.cols,
        // terminalHeight: initOptions.rows,
        timeout: initOptions.readyTimeout,
        sendTimeout: initOptions.readyTimeout,
        socketConnectOptions: shellOpts
      }
    )
    await connection.connect(params)
    this.port = connection.shell(shellOpts)
    this.channel = connection
    if (this.isTest) {
      this.kill()
      return true
    }
    globalState.setSession(this.initOptions.sessionId, {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    })
    return Promise.resolve(this)
  }

  resize = (cols, rows) => {
    Object.assign(this.channel.options, {
      terminalWidth: cols,
      terminalHeight: rows
    })
    this.channel.sendWindowSize()
  }

  on = (event, cb) => {
    this.port.on(event, cb)
  }

  write = (data) => {
    try {
      this.port.write(data)
      // this.writeLog(data)
    } catch (e) {
      log.error(e)
    }
  }

  kill = () => {
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

exports.terminalTelnet = async function (initOptions, ws) {
  const term = new TerminalTelnet(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnectionTelnet = (options) => {
  return (new TerminalTelnet(options, undefined, true))
    .init()
    .then(() => true)
    .catch(() => {
      return false
    })
}
