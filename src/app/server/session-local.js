/**
 * terminal/sftp/serial class
 */

const {
  resolve: pathResolve,
  isAbsolute
} = require('path')
const { statSync } = require('fs')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const {
  getPowerShellSpawnArgs
} = require('../common/powershell-integration')
// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

const maxStartDirectoryLength = 4096

/**
 * The directory a local pty should start in.
 *
 * The shell used to be spawned in the user's home directory and then told to
 * move with an injected `cd`/`Set-Location`. Anything that resolves a path
 * against the *process* cwd in that window - a tool printing relative paths,
 * the "open file location" action - landed in the home directory (or the
 * desktop, when the app was started from a shortcut) instead of the directory
 * the bookmark asked for (#4737). Starting the shell where it belongs makes the
 * injected `cd` a no-op and keeps every relative path honest.
 *
 * Only an existing absolute directory is accepted: node-pty fails to spawn on a
 * cwd it cannot use, so a stale bookmark path must fall back, not break the tab.
 */
const resolveStartDirectory = (dir) => {
  if (typeof dir !== 'string') {
    return ''
  }
  const value = dir.trim()
  if (
    !value ||
    value.length > maxStartDirectoryLength ||
    // control characters would be trimmed/interpreted by the OS in unclear ways
    /[\0\r\n]/.test(value) ||
    !isAbsolute(value)
  ) {
    return ''
  }
  try {
    const abs = pathResolve(value)
    return statSync(abs).isDirectory() ? abs : ''
  } catch (err) {
    return ''
  }
}

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
      term,
      startDirectoryLocal
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
    // Only the local start directory makes sense for a local pty: the remote
    // `startDirectory` belongs to the far machine, so it is never consulted
    // here (#4737).
    const cwd = resolveStartDirectory(startDirectoryLocal) ||
      process.env[platform === 'win32' ? 'USERPROFILE' : 'HOME']
    const userArgs = Array.isArray(arg) ? arg : []
    // Windows PowerShell gets the shell integration in its own argument list
    // instead of having it typed into the shell after connect: the script can
    // not be hidden that way (see common/powershell-integration.js). `null`
    // means "not PowerShell, or the user's arguments own execution" - then the
    // shell is spawned exactly as configured. The *platform's* shell is what
    // counts: the Windows setting exists on every platform, but it is not what
    // runs here.
    const shellPath = isWin
      ? execWindows
      : platform === 'darwin' ? execMac : execLinux
    const argv = getPowerShellSpawnArgs(shellPath, userArgs) ||
      (platform.startsWith('darwin') ? ['--login', ...userArgs] : userArgs)
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

  off (event, cb) {
    try {
      if (!this.term) {
        return
      }
      if (typeof this.term.removeListener === 'function') {
        this.term.removeListener(event, cb)
      } else if (typeof this.term.off === 'function') {
        this.term.off(event, cb)
      }
    } catch (_) {
      // ignore removal errors during teardown
    }
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
