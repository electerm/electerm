/**
 * terminal/sftp/serial class
 */
const { TerminalBase } = require('./session-base')
const { createRxConverter, convertTx } = require('./line-ending')
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
    this.rxConverter = createRxConverter(rxLineEnding)
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
    if (event === 'data' && this.rxConverter) {
      const wrapper = (data) => {
        const isBuffer = Buffer.isBuffer(data)
        const str = isBuffer ? data.toString('latin1') : String(data)
        const converted = this.rxConverter(str)
        cb(isBuffer ? Buffer.from(converted, 'latin1') : converted)
      }
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
    } else {
      this.port.on(event, cb)
    }
  }

  off (event, cb) {
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
      try {
        this.port?.removeListener?.(event, cb)
      } catch (_) {}
    } catch (_) {
      // ignore removal errors during teardown
    }
  }

  write (data) {
    try {
      const isBuffer = Buffer.isBuffer(data)
      const str = convertTx(
        isBuffer ? data.toString('latin1') : String(data),
        this.txLineEnding
      )
      this.port.write(isBuffer ? Buffer.from(str, 'latin1') : str)
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
