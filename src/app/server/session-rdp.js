/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const rdp = require('node-rdpjs')
const { TerminalBase } = require('./session-base')

class TerminalRdp extends TerminalBase {
  init = async () => {
    const {
      host,
      port,
      ...rest
    } = this.initOptions
    const channel = rdp.createClient(rest)
      .on('error', this.onError)
      .on('connect', this.onConnect)
      .on('bitmap', this.onBitmap)
      .on('end', this.kill)
      .connect(host, port)
    this.channel = channel
  }

  test = async () => {
    return new Promise((resolve, reject) => {
      const {
        host,
        port,
        ...rest
      } = this.initOptions
      const client = rdp.createClient(rest)
        .on('error', (err) => {
          log.error(err)
          reject(err)
        })
        .on('connect', () => {
          resolve(client)
        })
        .connect(host, port)
    })
  }

  onConnect = () => {
    this.ws.s({
      action: 'session-rdp-connected',
      ..._.pick(this.initOptions, [
        'sessionId',
        'tabId'
      ])
    })
  }

  onBitmap = (bitmap) => {
    this.ws.s({
      action: 'session-rdp-bitmap',
      sessionId: this.initOptions.sessionId,
      bitmap
    })
  }

  // action: 'sendPointerEvent', params: x, y, button, isPressed
  // action: 'sendWheelEvent', params: x, y, step, isNegative, isHorizontal
  // action: 'sendKeyEventScancode', params: code, isPressed
  // action: 'sendKeyEventUnicode', params: code, isPressed
  action = (data) => {
    const {
      action,
      params
    } = data
    if (
      [
        'sendPointerEvent',
        'sendWheelEvent',
        'sendKeyEventScancode',
        'sendKeyEventUnicode'
      ].includes(action)
    ) {
      this.channel[action](...params)
    } else {
      log.error('invalid action', action)
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
    .test()
    .then((res) => {
      res.close()
      return true
    })
    .catch(() => {
      return false
    })
}
