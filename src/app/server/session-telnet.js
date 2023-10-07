/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const generate = require('../common/uid')
const log = require('../common/log')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
const { Telnet } = require('./telnet')

class TerminalTelnet {
  constructor (initOptions, ws, isTest) {
    this.pid = initOptions.uid || generate()
    this.initOptions = initOptions
    if (initOptions.saveTerminalLogToFile) {
      this.sessionLogger = new SessionLog({
        fileName: createLogFileName(initOptions.logName)
      })
    }
    this.ws = ws
    this.isTest = isTest
  }

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
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    }
  }

  resize = (cols, rows) => {
    this.channel.opts.terminalWidth = cols
    this.channel.opts.terminalHeight = rows
  }

  on = (event, cb) => {
    this.port.on(event, cb)
  }

  write = (data) => {
    try {
      this.port.write(data)
      if (this.sshLogger) {
        this.sshLogger.write(data)
      }
    } catch (e) {
      log.error(e)
    }
  }

  kill = () => {
    this.channel && this.channel.end()
    if (this.sshLogger) {
      this.sshLogger.destroy()
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
