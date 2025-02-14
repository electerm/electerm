/**
 * terminal/sftp/serial class
 */
const generate = require('../common/uid')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
const _ = require('lodash')
const time = require('../common/time.js')
const globalState = require('./global-state')

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

class TerminalBase {
  constructor (initOptions, ws, isTest) {
    this.type = initOptions.termType || initOptions.type
    this.pid = initOptions.uid || generate()
    this.initOptions = initOptions
    if (initOptions.saveTerminalLogToFile) {
      this.sessionLogger = new SessionLog({
        logDir: initOptions.sessionLogPath,
        fileName: createLogFileName(initOptions.logName)
      })
    }
    if (ws) {
      this.ws = ws
    }
    if (isTest) {
      this.isTest = isTest
    }
  }

  cache = ''
  prevNewLine = true

  toggleTerminalLogTimestamp () {
    this.initOptions.addTimeStampToTermLog = !this.initOptions.addTimeStampToTermLog
  }

  toggleTerminalLog () {
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
      delete this.sessionLogger
    } else {
      this.sessionLogger = new SessionLog({
        fileName: createLogFileName(this.initOptions.logName)
      })
    }
  }

  parse (rawText) {
    let result = ''
    const len = rawText.length
    for (let i = 0; i < len; i++) {
      if (rawText[i] === '\b') {
        result = result.slice(0, -1)
      } else {
        result += rawText[i]
      }
    }
    return result
  }

  writeLog (data) {
    if (!this.sessionLogger) {
      return
    }
    const s = data.toString()
    if (!s.includes('\r\n')) {
      this.cache += s
      return
    }
    const p = this.parse(this.cache)
    const dt = this.prevNewLine && this.initOptions.addTimeStampToTermLog
      ? `[${time()}] `
      : ''
    const strip = require('@electerm/strip-ansi').default
    const str = strip(dt + p + s)
    this.sessionLogger.write(str)
    this.cache = ''
    this.prevNewLine = str.endsWith('\n')
  }

  onEndConn () {
    const inst = globalState.getSession(this.initOptions.sessionId)
    if (!inst) {
      return
    }
    if (this.ws) {
      delete this.ws
    }
    delete inst.sftps[this.pid]
    delete inst.terminals[this.pid]
    if (this.server && this.server.end) {
      this.server.end()
    }
    if (
      _.isEmpty(inst.sftps) &&
      _.isEmpty(inst.terminals)
    ) {
      this.endConns && this.endConns()
      globalState.removeSession(this.initOptions.sessionId)
    }
  }
}

exports.TerminalBase = TerminalBase
