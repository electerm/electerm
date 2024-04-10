/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const rdp = require('node-rdpjs')
const { TerminalBase } = require('./session-base')

// complete rdp session related functions
class TerminalRdp extends TerminalBase {
  init = async () => {
    const {
      domain,
      username,
      password,
      enablePerf,
      autoLogin,
      decompress,
      screen,
      locale,
      logLevel,
      host,
      port
    } = this.initOptions
    const channel = rdp.createClient({
      domain,
      username,
      password,
      enablePerf,
      autoLogin,
      decompress,
      screen,
      locale,
      logLevel
    })
      .on('error', (err) => {
        log.error(err)
      })
      .on('end', this.kill)
      .connect(host, port)
    this.channel = channel
  }

  resize = (cols, rows) => {
    this.channel.screen.width = cols
    this.channel.screen.height = rows
  }

  on = (event, cb) => {
    this.channel.on(event, cb)
  }

  write = (data) => {
    try {
      this.channel.write(data)
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

exports.TerminalRdp = async function (initOptions, ws) {
  const term = new TerminalRdp(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnectionRdp = (options) => {
  return (new TerminalRdp(options, undefined, true))
    .init()
    .then(() => true)
    .catch(() => {
      return false
    })
}
