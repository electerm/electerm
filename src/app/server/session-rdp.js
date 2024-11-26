/**
 * terminal/sftp/serial class
 */
const _ = require('lodash')
const log = require('../common/log')
const rdp = require('@electerm/rdpjs')
const { TerminalBase } = require('./session-base')
const { isDev } = require('../common/runtime-constants')
const globalState = require('./global-state')

class TerminalRdp extends TerminalBase {
  init = async () => {
    globalState.setSession(this.initOptions.sessionId, {
      id: this.initOptions.sessionId,
      sftps: {},
      terminals: {
        [this.pid]: this
      }
    })
    return Promise.resolve(this)
  }

  start = async (width, height) => {
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    if (this.channel) {
      this.channel.close()
      delete this.channel
    }
    const {
      host,
      port,
      ...rest
    } = this.initOptions
    const opts = {
      ...rest,
      logLevel: isDev ? 'DEBUG' : 'ERROR',
      screen: {
        width,
        height
      }
    }
    if (!opts.domain) {
      opts.domain = host
    }
    const channel = rdp.createClient(opts)
      .on('error', this.onError)
      .on('connect', this.onConnect)
      .on('bitmap', this.onBitmap)
      .on('end', this.kill)
      .connect(host, port)
    this.channel = channel
    this.width = width
    this.height = height
  }

  resize () {

  }

  onError = (err) => {
    if (err.message.includes('read ECONNRESET')) {
      this.ws && this.start(
        this.width,
        this.height
      )
    } else {
      log.error('rdp error', err)
    }
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
    this.isRunning = false
    if (this.ws) {
      if (!this.isWsEventRegistered) {
        this.ws.on('message', this.onAction)
        this.ws.on('close', this.kill)
        this.isWsEventRegistered = true
      }
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
  }

  onBitmap = (bitmap) => {
    this.ws && this.ws.send(JSON.stringify(
      bitmap
    ))
  }

  // action: 'sendPointerEvent', params: x, y, button, isPressed
  // action: 'sendWheelEvent', params: x, y, step, isNegative, isHorizontal
  // action: 'sendKeyEventScancode', params: code, isPressed
  // action: 'sendKeyEventUnicode', params: code, isPressed
  onAction = (_data) => {
    if (!this.channel || this.isRunning) {
      return
    }
    const data = JSON.parse(_data)
    const {
      action,
      params
    } = data
    if (action === 'reload') {
      this.start(
        ...params
      )
    } else if (
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
    log.debug('Closed rdp session ' + this.pid)
    if (this.ws) {
      this.ws.close()
      delete this.ws
    }
    this.channel && this.channel.close()
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    const inst = globalState.getSession(this.initOptions.sessionId)
    if (!inst) {
      return
    }
    delete inst.terminals[this.pid]
    if (
      _.isEmpty(inst.terminals)
    ) {
      globalState.removeSession(this.initOptions.sessionId)
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
