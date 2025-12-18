/**
 * terminal/sftp/serial class
 */
const _ = require('../lib/lodash.js')
const log = require('../common/log')
const { Telnet } = require('./telnet')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

// Helper function to convert regex string to RegExp object
function stringToRegExp (regexString) {
  // Check if it's already a RegExp
  if (regexString instanceof RegExp) {
    return regexString
  }

  // Parse string format like /pattern/flags
  const match = regexString.match(/^\/(.+)\/([gimsuy]*)$/)
  if (match) {
    const [, pattern, flags] = match
    return new RegExp(pattern, flags)
  }

  // If no slashes, treat as plain pattern
  return new RegExp(regexString)
}

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
        'terminalHeight',
        'proxy'
      ]
    )
    // Convert string regex patterns to RegExp objects
    if (typeof initOptions.loginPrompt === 'string') {
      params.loginPrompt = stringToRegExp(initOptions.loginPrompt)
    }
    if (typeof initOptions.passwordPrompt === 'string') {
      params.passwordPrompt = stringToRegExp(initOptions.passwordPrompt)
    }
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
    globalState.setSession(this.pid, this)
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
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  const term = new TerminalTelnet(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.test = (options) => {
  return (new TerminalTelnet(options, undefined, true))
    .init()
    .then(() => true)
    .catch(() => {
      return false
    })
}
