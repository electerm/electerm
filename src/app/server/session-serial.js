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
      txLineEnding = '\r',
      rxLineEnding = 'none',
      path
    } = this.initOptions
    this.txLineEnding = txLineEnding
    this.rxLineEnding = rxLineEnding
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
    globalState.setSession(this.pid, this)
    return Promise.resolve(this)
  }

  resize () {

  }

  on (event, cb) {
    if (event === 'data' && this.rxLineEnding && this.rxLineEnding !== 'none') {
      this.port.on('data', (data) => {
        const str = Buffer.isBuffer(data) ? data.toString('latin1') : String(data)
        let processed
        if (this.rxLineEnding === 'lf_to_crlf') {
          processed = str.replace(/\r?\n/g, '\r\n')
        } else if (this.rxLineEnding === 'cr_to_crlf') {
          processed = str.replace(/\r(?!\n)/g, '\r\n')
        } else {
          processed = str
        }
        cb(Buffer.isBuffer(data) ? Buffer.from(processed, 'latin1') : processed)
      })
    } else {
      this.port.on(event, cb)
    }
  }

  write (data) {
    try {
      const str = Buffer.isBuffer(data) ? data.toString('latin1') : String(data)
      let out = str
      if (this.txLineEnding && this.txLineEnding !== '\r') {
        out = str.replace(/\r\n|\r|\n/g, this.txLineEnding)
      }
      this.port.write(Buffer.isBuffer(data) ? Buffer.from(out, 'latin1') : out)
    } catch (e) {
      log.error(e)
    }
  }

  /**
   * Write raw bytes directly to the serial port, bypassing txLineEnding transformation.
   * Used by binary protocols (XMODEM) to avoid corruption of protocol bytes.
   */
  writeRaw (data) {
    try {
      this.port.write(data)
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

exports.session = async function (initOptions, ws) {
  const term = new TerminalSerial(initOptions, ws)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.test = (initOptions) => {
  return (new TerminalSerial(initOptions, undefined, true))
    .init()
    .then(() => true)
    .catch(() => {
      return false
    })
}
