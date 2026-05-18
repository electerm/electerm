/**
 * terminal/sftp/serial class
 */
const generate = require('../common/uid')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
const time = require('../common/time.js')
const globalState = require('./global-state')

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

function createVtParser (cols = 220) {
  const { Terminal } = require('@xterm/headless')
  const term = new Terminal({ cols, rows: 50, allowProposedApi: true })
  return term
}

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
      this._initVtParser()
    }
    if (ws) {
      this.ws = ws
    }
    if (isTest) {
      this.isTest = isTest
    }
  }

  _initVtParser () {
    this._vtTerm = createVtParser(this.initOptions.cols || 220)
    this._vtLastRow = 0
    this._vtTerm.onLineFeed(() => {
      if (!this.sessionLogger) return
      const buffer = this._vtTerm.buffer.active
      const row = buffer.baseY + buffer.cursorY - 1
      if (row < 0) return
      const line = buffer.getLine(row)
      if (!line) return
      const text = line.translateToString(true)
      const dt = this.initOptions.addTimeStampToTermLog
        ? `[${time()}] `
        : ''
      this.sessionLogger.write(dt + text + '\n')
    })
  }

  toggleTerminalLogTimestamp () {
    this.initOptions.addTimeStampToTermLog = !this.initOptions.addTimeStampToTermLog
  }

  toggleTerminalLog () {
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
      delete this.sessionLogger
      if (this._vtTerm) {
        this._vtTerm.dispose()
        delete this._vtTerm
      }
    } else {
      this.sessionLogger = new SessionLog({
        logDir: this.initOptions.sessionLogPath,
        fileName: createLogFileName(this.initOptions.logName)
      })
      this._initVtParser()
    }
  }

  setTerminalLogPath (logPath) {
    if (!logPath) {
      return
    }
    this.initOptions.sessionLogPath = logPath
    if (this.sessionLogger) {
      // Reopen the log under the new path
      this.sessionLogger.destroy()
      if (this._vtTerm) {
        this._vtTerm.dispose()
        delete this._vtTerm
      }
      this.sessionLogger = new SessionLog({
        logDir: this.initOptions.sessionLogPath,
        fileName: createLogFileName(this.initOptions.logName)
      })
      this._initVtParser()
    }
  }

  writeLog (data) {
    if (!this.sessionLogger || !this._vtTerm) {
      return
    }
    this._vtTerm.write(data)
  }

  onEndConn () {
    const {
      pid
    } = this
    const inst = globalState.getSession(pid)
    if (!inst) {
      return
    }
    if (this.ws) {
      delete this.ws
    }
    if (this._vtTerm) {
      this._vtTerm.dispose()
      delete this._vtTerm
    }
    if (this.server && this.server.end) {
      this.server.end()
    }
    globalState.removeSession(pid)
  }
}

exports.TerminalBase = TerminalBase
