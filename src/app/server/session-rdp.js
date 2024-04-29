/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const rdp = require('node-rdpjs-2')
const { TerminalBase } = require('./session-base')

class TerminalRdp extends TerminalBase {
  init = async () => {
    console.log('init')
    global.sessions[this.initOptions.sessionId] = {
      id: this.initOptions.sessionId,
      terminals: {
        [this.pid]: this
      }
    }
    return Promise.resolve(this)
  }

  start = async (width, height) => {
    console.log('start')
    const {
      host,
      port,
      ...rest
    } = this.initOptions
    const channel = rdp.createClient({
      ...rest,
      screen: {
        width,
        height
      }
    })
      .on('error', this.onError)
      .on('connect', this.onConnect)
      .on('bitmap', this.onBitmap)
      .on('end', this.kill)
      .connect(host, port)
    this.channel = channel
  }

  onError = (err) => {
    log.error('rdp error', err)
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
    console.log('onConnect')
    this.ws.send(
      JSON.stringify(
        {
          action: 'session-rdp-connected',
          ..._.pick(this.initOptions, [
            'sessionId',
            'tabId'
          ])
        }
      )
    )
  }

  onBitmap = (bitmap) => {
    console.log('onBitmap', bitmap)
    this.ws.send(JSON.stringify(
      bitmap
    ))
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
    if (this.ws) {
      delete this.ws
    }
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

exports.terminalRdp = async function (initOptions, ws) {
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
