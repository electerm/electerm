/**
 * terminal/sftp/serial class
 */

const { resolve: pathResolve } = require('path')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const { execSync } = require('child_process')

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

function getUserPathFromRegistry () {
  try {
    // Use reg.exe instead of powershell to avoid PATH-length-induced command line corruption
    const output = execSync(
      'reg query "HKCU\\Environment" /v Path',
      { encoding: 'utf8', windowsHide: true, env: { SystemRoot: process.env.SystemRoot } }
    ).trim()
    // Output format: "    Path    REG_SZ    <value>" or "    Path    REG_EXPAND_SZ    <value>"
    const match = output.match(/Path\s+REG(?:_EXPAND)?_SZ\s+(.+)$/im)
    return match ? match[1].trim() : ''
  } catch (e) {
    console.error('[electerm] getUserPathFromRegistry failed:', e.message)
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
      term
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
    const argv = platform.startsWith('darwin') ? ['--login', ...arg] : arg
    const pty = require('node-pty')
    const env = Object.assign({}, process.env)
    // if (!env.SystemRoot) {
    //   env.SystemRoot = process.env.windir
    // }
    if (platform.startsWith('win')) {
      const userPath = getUserPathFromRegistry()
      if (userPath) {
        const currentPath = env.PATH || ''
        const pathParts = currentPath.split(';').filter(p => p)
        const pathPartsLower = pathParts.map(p => p.toLowerCase())
        const userPathParts = userPath.split(';').filter(p => p && !pathPartsLower.includes(p.toLowerCase()))
        env.PATH = [...userPathParts, ...pathParts].join(';')
      }
    }
    this.term = pty.spawn(exec, argv, {
      name: term,
      encoding: null,
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env
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
