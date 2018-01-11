/**
 * terminal class
 */
const pty = require('node-pty')
const {Client} = require('ssh2')
const _ = require('lodash')
const {generate} = require('shortid')

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
    let exe = process.platform.startsWith('win') ? 'powershell.exe' : 'bash'
    this.term = pty.spawn(exe, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.HOME,
      env: process.env
    })
    return Promise.resolve()
  }

  remoteInit(initOptions) {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      let opts = Object.assign(
        {},
        {
          readyTimeout: _.get(global, 'et._config.sshReadyTimeout')
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
      conn.on('ready', () => {
        conn.shell(
          _.pick(initOptions, ['rows', 'cols', 'mode']),
          (err, channel) => {
            if (err) {
              return reject(err)
            }
            this.channel = channel
            resolve(true)
          }
        )
      }).on('error', err => {
        reject(err)
      }).connect(opts)

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
    (this.term || this.channel).write(data)
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
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.end()
      resolve()
    }).on('error', err => {
      reject(err)
    }).connect(options)
  })
}
