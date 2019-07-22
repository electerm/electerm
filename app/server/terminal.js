/**
 * terminal class
 */
const pty = require('node-pty')
const { Client } = require('@electerm/ssh2')
const proxySock = require('./socks')
const _ = require('lodash')
const { generate } = require('shortid')
const { resolve } = require('path')
const net = require('net')
const { exec } = require('child_process')
const log = require('../utils/log')

function getDisplay () {
  return new Promise((resolve) => {
    exec('echo $DISPLAY', (err, out, e) => {
      if (err || e) {
        resolve('')
      } else {
        resolve((out || '').trim())
      }
    })
  })
}

function getX11Cookie () {
  return new Promise((resolve) => {
    exec('xauth list :0', (err, out, e) => {
      if (err || e) {
        resolve('')
      } else {
        const s = out || ''
        const reg = /MIT-MAGIC-COOKIE-1 +([\d\w]{1,38})/
        const arr = s.match(reg)
        resolve(
          arr ? arr[1] || '' : ''
        )
      }
    })
  })
}

class Terminal {
  constructor (initOptions) {
    this.type = initOptions.type
    this.pid = generate()
    this.initOptions = initOptions
  }

  init () {
    return this[this.type + 'Init'](this.initOptions)
  }

  localInit (initOptions) {
    const {
      cols,
      rows,
      execWindows,
      execMac,
      execLinux
    } = initOptions
    const { platform } = process
    const exe = platform.startsWith('win')
      ? resolve(
        process.env.windir,
        execWindows
      )
      : platform === 'darwin' ? execMac : execLinux
    const cwd = process.env[platform === 'win32' ? 'USERPROFILE' : 'HOME']
    const argv = platform.startsWith('darwin') ? ['--login'] : []
    this.term = pty.spawn(exe, argv, {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env
    })
    return Promise.resolve()
  }

  async remoteInit (initOptions, isTest) {
    const display = await getDisplay()
    const x11Cookie = await getX11Cookie()
    return new Promise((resolve, reject) => {
      const conn = new Client()
      const opts = Object.assign(
        {
          tryKeyboard: true
        },
        {
          readyTimeout: _.get(initOptions, 'readyTimeout'),
          keepaliveInterval: _.get(initOptions, 'keepaliveInterval'),
          agent: process.env.SSH_AUTH_SOCK,
          algorithms: {
            hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1', 'hmac-sha1-96'],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes128-gcm@openssh.com',
              'aes256-gcm',
              'aes256-gcm@openssh.com',
              'aes256-cbc'
            ]
          }
        },
        _.pick(initOptions, [
          'host',
          'port',
          'username',
          'password',
          'privateKey',
          'passphrase'
        ])
      )
      if (!opts.password) {
        delete opts.password
      }
      if (!opts.passphrase) {
        delete opts.passphrase
      }
      let x11
      if (initOptions.x11 === true) {
        x11 = {
          cookie: x11Cookie
        }
      }
      const shellOpts = {
        ..._.pick(initOptions, [
          'rows', 'cols', 'term'
        ]),
        x11
      }
      const run = (info) => {
        if (info && info.socket) {
          delete opts.host
          delete opts.port
          opts.sock = info.socket
        }
        conn
          .on('keyboard-interactive', (
            name,
            instructions,
            instructionsLang,
            prompts,
            finish
          ) => {
            finish([opts.password])
          })
          .on('x11', function (info, accept) {
            let start = 0
            const maxRetry = 100
            const portStart = 6000
            const maxPort = portStart + maxRetry
            function retry () {
              if (start >= maxPort) {
                return
              }
              const xserversock = new net.Socket()
              let xclientsock
              xserversock
                .on('connect', function () {
                  xclientsock = accept()
                  xclientsock.pipe(xserversock).pipe(xclientsock)
                })
                .on('error', (e) => {
                  log.error(e)
                  xserversock.destroy()
                  start = start === maxRetry ? portStart : start + 1
                  retry()
                })
                .on('close', () => {
                  xserversock.destroy()
                  xclientsock && xclientsock.destroy()
                })
              if (start < portStart) {
                const addr = display.includes('/tmp')
                  ? display
                  : `/tmp/.X11-unix/X${start}`
                xserversock.connect(addr)
              } else {
                xserversock.connect(start, 'localhost')
              }
            }
            retry()
          })
          .on('ready', () => {
            if (isTest) {
              conn.end()
              return resolve(true)
            }
            conn.shell(
              shellOpts,
              (err, channel) => {
                if (err) {
                  return reject(err)
                }
                this.channel = channel
                resolve(true)
              }
            )
          })
          .on('error', err => {
            log.error('errored terminal', err)
            conn.end()
            reject(err)
          })
          .connect(opts)
      }
      if (
        initOptions.proxy &&
        initOptions.proxy.proxyIp &&
        initOptions.proxy.proxyPort
      ) {
        proxySock({
          ...initOptions,
          ...opts
        })
          .then(run)
          .catch(reject)
      } else {
        run()
      }
      this.conn = conn
    })
  }

  resize (cols, rows) {
    this[this.type + 'Resize'](cols, rows)
  }

  localResize (cols, rows) {
    this.term.resize(cols, rows)
  }

  remoteResize (cols, rows) {
    this.channel.setWindow(rows, cols)
  }

  on (event, cb) {
    this[this.type + 'On'](event, cb)
  }

  localOn (event, cb) {
    this.term.on(event, cb)
  }

  remoteOn (event, cb) {
    this.channel.on(event, cb)
    this.channel.stderr.on(event, cb)
  }

  write (data) {
    try {
      (this.term || this.channel).write(data)
    } catch (e) {
      log.error(e)
    }
  }

  kill () {
    if (this.term) {
      return this.term.kill()
    }
    this.conn.end()
  }
}

exports.terminal = async function (initOptions) {
  const term = new Terminal(initOptions)
  await term.init()
  return term
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.testConnection = (options) => {
  return (new Terminal(options)).remoteInit(options, true)
}
