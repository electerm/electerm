/**
 * terminal/sftp/serial class
 */

const { resolve: pathResolve } = require('path')
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')
const { execSync } = require('child_process')

// const { MockBinding } = require('@serialport/binding-mock')
// MockBinding.createPort('/dev/ROBOT', { echo: true, record: true })

/**
 * Read a PATH value from the Windows registry and expand any %VAR% references.
 * Returns an array of path strings, or [] on failure.
 */
function getPathFromRegistry (key) {
  try {
    const output = execSync(
      `reg query "${key}" /v Path`,
      { encoding: 'utf8', windowsHide: true, env: { SystemRoot: process.env.SystemRoot } }
    ).trim()
    const match = output.match(/Path\s+REG(?:_EXPAND)?_SZ\s+(.+)$/im)
    if (!match) return []
    // Expand %VAR% references (REG_EXPAND_SZ values are not auto-expanded by reg.exe)
    const expanded = match[1].trim().replace(/%([^%]+)%/g, (_, name) => {
      return process.env[name] || process.env[name.toUpperCase()] || `%${name}%`
    })
    return expanded.split(';').filter(Boolean)
  } catch (e) {
    return []
  }
}

let windowsShellPathCache = null

/**
 * Build the PATH that a fresh Windows shell session would have, by reading
 * both the machine-wide and user PATH directly from the registry.
 * This avoids relying on process.env.PATH, which is a frozen snapshot from
 * when Electron was launched and may be stale or missing the user PATH.
 * Result is cached — registry values don't change during a running session.
 */
function getWindowsShellPath () {
  if (windowsShellPathCache !== null) return windowsShellPathCache
  const systemParts = getPathFromRegistry(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  )
  const userParts = getPathFromRegistry('HKCU\\Environment')
  // Merge: system first, then user entries not already present (case-insensitive).
  // Order matters: git resolves credential helpers by first match in PATH, so
  // system-bundled helpers (pipe-based) must not be shadowed by user-installed
  // GUI helpers (e.g. GCM in %LOCALAPPDATA%\Microsoft\WindowsApps) which hang
  // inside a ConPTY where no window can be shown.
  const systemLower = new Set(systemParts.map(p => p.toLowerCase()))
  const merged = [...systemParts, ...userParts.filter(p => !systemLower.has(p.toLowerCase()))]
  windowsShellPathCache = merged.join(';')
  return windowsShellPathCache
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
      const shellPath = getWindowsShellPath()
      if (shellPath) {
        env.PATH = shellPath
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
