/**
 * terminal/sftp/serial class
 */

const { resolve: pathResolve } = require('path')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

class TerminalLocal extends TerminalBase {
  init () {
    const {
      cols,
      rows,
      execWindows,
      execMac,
      execLinux,
      execWindowsArgs,
      execMacArgs,
      execLinuxArgs,
      termType,
      term
    } = this.initOptions
    this.isLocal = true
    const { platform } = process
    const isWin = platform.startsWith('win')
    const exec = isWin
      ? pathResolve(
        process.env.windir,
        execWindows
      )
      : platform === 'darwin' ? execMac : execLinux
    if ((exec || '').includes('..')) {
      return Promise.reject(new Error('execWindows should not contain ".."'))
    }
    const arg = isWin
      ? execWindowsArgs
      : platform === 'darwin' ? execMacArgs : execLinuxArgs
    const cwd = process.env[platform === 'win32' ? 'USERPROFILE' : 'HOME']
    const argv = platform.startsWith('darwin') ? ['--login', ...arg] : arg
    const pty = require('node-pty')
    const env = Object.assign({}, process.env)
    delete env.ELECTRON_RUN_AS_NODE
    delete env.NODE_OPTIONS
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    // temp PEM of system CAs for the server process (WebDAV sync, #4347) —
    // not meant for user shells, and a bad keychain cert makes any Node/bun
    // tool in the terminal print "ignoring extra certs ... load failed"
    delete env.NODE_EXTRA_CA_CERTS
    this.term = pty.spawn(exec, argv, {
      name: term,
      encoding: null,
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env,
      // Use the OpenConsole conpty.dll shipped with node-pty instead of the
      // legacy Windows Console Host (kernel32 CreatePseudoConsole) conpty.
      // The legacy console-host conpty can stall output and deliver Ctrl+C to
      // the whole process group (killing the shell too) after a full-screen
      // TUI like opencode exits, leaving the terminal tab unresponsive.
      // The OpenConsole conpty.dll does not have this problem.
      useConptyDll: true
    })
    this.term.termType = termType
    globalState.setSession(this.pid, this)
    return Promise.resolve(this)
  }

  resize (cols, rows) {
    this.term.resize(cols, rows)
  }

  on (event, cb) {
    this.term.on(event, cb)
  }

  write (data) {
    this.term.write(data)
  }

  kill () {
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    this.term && this.term.kill()
    this.onEndConn()
  }
}

exports.session = function (initOptions, ws) {
  return (new TerminalLocal(initOptions, ws)).init()
}

/**
 * test ssh connection
 * @param {object} options
 */
exports.test = (initOptions) => {
  return Promise.resolve(true)
}
