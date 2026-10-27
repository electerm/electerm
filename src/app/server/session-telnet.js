/**
 * terminal/sftp/serial class
 */
const _ = require('../lib/lodash.js')
const log = require('../common/log')
const { Telnet } = require('./telnet')
const { createRxConverter, convertTx } = require('./line-ending')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const iconv = require('iconv-lite')

// Encodings that are equivalent to UTF-8 (no conversion needed)
const utf8Aliases = new Set(['utf-8', 'utf8', 'utf-8-strict'])

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
    // Telnet to a serial port server has no line discipline anywhere in the
    // path, so the same two knobs the serial session has apply here (#4649)
    this.txLineEnding = initOptions.txLineEnding || '\r'
    this.rxConverter = createRxConverter(initOptions.rxLineEnding)
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
    if (!this.channel) {
      return
    }
    Object.assign(this.channel.options, {
      terminalWidth: cols,
      terminalHeight: rows
    })
    this.channel.sendWindowSize()
  }

  on = (event, cb) => {
    if (event === 'data' && this.rxConverter) {
      const wrapper = (data) => {
        const isBuffer = Buffer.isBuffer(data)
        const str = isBuffer ? data.toString('latin1') : String(data)
        const converted = this.rxConverter(str)
        cb(isBuffer ? Buffer.from(converted, 'latin1') : converted)
      }
      // off() is always called with the original callback, never the wrapper,
      // so the wrapper has to be remembered to detach it on close
      if (!this._onWrappers) {
        this._onWrappers = new Map()
      }
      let list = this._onWrappers.get(cb)
      if (!list) {
        list = []
        this._onWrappers.set(cb, list)
      }
      list.push({ event, wrapper })
      this.port.on(event, wrapper)
      return
    }
    this.port.on(event, cb)
  }

  off = (event, cb) => {
    try {
      const list = this._onWrappers?.get(cb)
      if (list) {
        const remaining = []
        for (const entry of list) {
          if (entry.event === event) {
            try {
              this.port?.removeListener?.(event, entry.wrapper)
            } catch (_) {}
          } else {
            remaining.push(entry)
          }
        }
        if (remaining.length) {
          this._onWrappers.set(cb, remaining)
        } else {
          this._onWrappers.delete(cb)
        }
      }
      this.port?.removeListener?.(event, cb)
    } catch (_) {
      // ignore removal errors during teardown
    }
  }

  write = (data) => {
    try {
      const encode = this.initOptions?.encode
      const isBuffer = Buffer.isBuffer(data)
      const str = convertTx(
        isBuffer ? data.toString('latin1') : String(data),
        this.txLineEnding
      )
      if (encode && !utf8Aliases.has(encode.toLowerCase()) && !isBuffer) {
        try {
          this.port.write(iconv.encode(str, encode))
          return
        } catch (e) {
          log.warn('iconv encode failed, falling back to raw write:', e.message)
        }
      }
      this.port.write(isBuffer ? Buffer.from(str, 'latin1') : str)
      // this.writeLog(data)
    } catch (e) {
      log.error(e)
    }
  }

  kill = () => {
    if (this.channel) {
      try {
        this.channel.end()
      } catch (e) {
        log.warn('telnet end failed:', e.message)
      }
      try {
        this.channel.destroy()
      } catch (e) {
        log.warn('telnet destroy failed:', e.message)
      }
    }
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
