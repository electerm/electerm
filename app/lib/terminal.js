/**
 * terminal class
 */
const pty = require('node-pty')
const {Client} = require('ssh2')
const proxySock = require('./socks')
const _ = require('lodash')
const {generate} = require('shortid')
const {resolve} = require('path')

class Terminal {

  constructor(initOptions) {
    this.type = initOptions.type
    this.pid = generate()
    this.initOptions = initOptions
  }

  init() {
    return this[this.type + 'Init'](this.initOptions)
  }

  localInit(initOptions) {
    let {
      cols,
      rows
    } = initOptions
    let {platform} = process
    let exe = platform.startsWith('win')
      ? resolve(
        process.env.windir,
        'System32/WindowsPowerShell/v1.0/powershell.exe'
      )
      : 'bash'
    let cwd = process.env[
      platform === 'win32' ? 'USERPROFILE' : 'HOME'
    ]
    let argv = platform.startsWith('darwin') ? ['--login'] : []
    this.term = pty.spawn(exe, argv, {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env
    })
    return Promise.resolve()
  }

  remoteInit(initOptions, isTest) {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      let opts = Object.assign(
        {
          tryKeyboard: true
        },
        {
          readyTimeout: _.get(initOptions, 'sshReadyTimeout'),
          keepaliveInterval: _.get(initOptions, 'keepaliveInterval'),
          agent: process.env.SSH_AUTH_SOCK
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
          .on('ready', () => {
            if (isTest) {
              conn.end()
              return resolve(true)
            }
            conn.shell(
              _.pick(initOptions, ['rows', 'cols', 'term']),
              // {
              //   env: process.env
              // },
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

  resize(cols, rows) {
    this[this.type + 'Resize'](cols, rows)
  }

  localResize(cols, rows) {
    this.term.resize(cols, rows)
  }

  remoteResize(cols, rows) {
    this.channel.setWindow(rows, cols)
  }

  on(event, cb) {
    this[this.type + 'On'](event, cb)
  }

  localOn(event, cb) {
    this.term.on(event, cb)
  }

  remoteOn(event, cb) {
    this.channel.on(event, cb)
    this.channel.stderr.on(event, cb)
  }

  write(data) {
    try {
      (this.term || this.channel).write(data)
    } catch (e) {
      console.log(e)
    }
  }

  kill() {
    if (this.term) {
      return this.term.kill()
    }
    this.conn.end()
  }

}

exports.terminal = async function(initOptions) {
  let term = new Terminal(initOptions)
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
