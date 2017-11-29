/**
 * terminal class
 */
const pty = require('node-pty')
const ssh2 = require('ssh2')

class Terminal {

  constructor(initOptions) {
    this.type = initOptions.type
    this[this.type + 'Init'](initOptions)
  }

  localInit(initOptions) {
    let {
      cols,
      rows
    } = initOptions
    let exe = process.platform.includes('win') ? 'powershell.exe' : 'bash'
    this.term = pty.spawn(exe, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.HOME,
      env: process.env
    })
    this.pid = this.term.pid
  }

  remoteInit(initOptions) {

  }

  resize(cols, rows) {

  }

  on(event, cb) {

  }

  write(data) {

  }

  kill() {

  }

}

exports.Terminal = Terminal

