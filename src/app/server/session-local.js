/**
 * terminal/sftp/serial class
 */

const { resolve: pathResolve } = require('path')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const {
  getShellIntegrationEnv,
  getShellIntegrationArgs,
  getShellIntegrationInitCommand,
  getShellType
} = require('../shell-integration')

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
      term,
      enableShellIntegration = true
    } = this.initOptions
    this.isLocal = true
    const { platform } = process
    const exec = platform.startsWith('win')
      ? pathResolve(
        process.env.windir,
        execWindows
      )
      : platform === 'darwin' ? execMac : execLinux
    const arg = platform.startsWith('win')
      ? execWindowsArgs
      : platform === 'darwin' ? execMacArgs : execLinuxArgs
    const cwd = process.env[platform === 'win32' ? 'USERPROFILE' : 'HOME']
    let argv = platform.startsWith('darwin') ? ['--login', ...arg] : arg

    // Build environment with shell integration if enabled and not on Windows
    let env = { ...process.env }
    const isWindows = platform.startsWith('win')

    if (enableShellIntegration && !isWindows) {
      const shellIntegrationEnv = getShellIntegrationEnv(exec)
      env = { ...env, ...shellIntegrationEnv }
      console.log('[TerminalLocal] Shell integration enabled, env:', shellIntegrationEnv)

      // For fish, we need to modify args to source the integration script
      const shellType = getShellType(exec)
      if (shellType === 'fish') {
        argv = getShellIntegrationArgs(exec, argv)
        console.log('[TerminalLocal] Fish shell, modified argv:', argv)
      }
    }

    const pty = require('node-pty')
    this.term = pty.spawn(exec, argv, {
      name: term,
      encoding: null,
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env
    })
    this.term.termType = termType
    this.shellIntegrationEnabled = enableShellIntegration && !isWindows

    // For bash and zsh, send init command after shell starts
    if (this.shellIntegrationEnabled) {
      const initCmd = getShellIntegrationInitCommand(exec)
      console.log('[TerminalLocal] Shell integration init command:', JSON.stringify(initCmd))
      if (initCmd) {
        // Small delay to let the shell initialize before sourcing
        setTimeout(() => {
          if (this.term) {
            console.log('[TerminalLocal] Writing init command to terminal')
            this.term.write(initCmd)
          }
        }, 100)
      }
    }

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
