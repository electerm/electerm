/**
 * terminal/sftp/serial class
 */
const generate = require('../common/uid')
const { createLogFileName } = require('../common/create-session-log-file-path')
const SessionLog = require('./session-log')
const _ = require('lodash')

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

class TerminalBase {
  constructor (initOptions, ws, isTest) {
    this.type = initOptions.termType || initOptions.type
    this.pid = initOptions.uid || generate()
    this.initOptions = initOptions
    if (initOptions.saveTerminalLogToFile) {
      this.sessionLogger = new SessionLog({
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

  onEndConn () {
    const inst = global.sessions[
      this.initOptions.sessionId
    ]
    if (!inst) {
      return
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
      delete global.sessions[
        this.initOptions.sessionId
      ]
    }
  }
}

exports.TerminalBase = TerminalBase
