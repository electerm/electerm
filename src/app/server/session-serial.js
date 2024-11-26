/**
 * terminal/sftp/serial class
 */
const { TerminalBase } = require('./session-base')
const log = require('../common/log')
const globalState = require('./global-state')
// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

class TerminalSerial extends TerminalBase {
  async init () {
    const { SerialPort } = require('serialport')
    // https://serialport.io/docs/api-stream
    const {
      autoOpen = true,
      baudRate = 9600,
      dataBits = 8,
      lock = true,
      stopBits = 1,
      parity = 'none',
      rtscts = false,
      xon = false,
      xoff = false,
      xany = false,
      path
    } = this.initOptions
    await new Promise((resolve, reject) => {
      this.port = new SerialPort({
        // binding: MockBinding,
        path,
        autoOpen,
        baudRate,
        dataBits,
        lock,
        stopBits,
        parity,
        rtscts,
        xon,
        xoff,
        xany
      }, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve('ok')
        }
      })
    })
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

  resize () {

  }

  on (event, cb) {
    this.port.on(event, cb)
  }

  write (data) {
    try {
      this.port.write(data)
      // this.writeLog(data)
    } catch (e) {
      log.error(e)
    }
  }

  kill () {
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    this.port && this.port.isOpen && this.port.close()
    delete this.port
    this.onEndConn()
  }
}

exports.terminalSerial = async function (initOptions, ws) {
  const term = new TerminalSerial(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnectionSerial = (initOptions) => {
  return (new TerminalSerial(initOptions, undefined, true))
    .init()
    .then(() => true)
    .catch(() => {
      return false
    })
}
