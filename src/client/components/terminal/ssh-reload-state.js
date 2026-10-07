const maxCwdLength = 4096

// Shell-backed terminal types whose cwd + screen can be restored on reload.
// Graphical / file-transfer tabs (rdp, vnc, web, ftp, spice, sftp, ...) are
// intentionally excluded: they have no shell cwd to `cd` back to.
export const restorableTerminalTypes = new Set([
  'ssh',
  'local',
  'telnet',
  'serial'
])

export function isSshTab (tab = {}) {
  return !!tab.host && (!tab.type || tab.type === 'ssh')
}

export function isRestorableTerminalTab (tab = {}) {
  if (!tab.type) {
    // Legacy tabs without an explicit type are ssh (host set) or local
    // (no host) - both are shell terminals.
    return true
  }
  return restorableTerminalTypes.has(tab.type)
}

export function sanitizeSshCwd (cwd) {
  if (typeof cwd !== 'string' || !cwd || cwd.length > maxCwdLength) {
    return ''
  }
  if (/[\0\r\n]/.test(cwd)) {
    return ''
  }
  return cwd
}

export const sanitizeTerminalCwd = sanitizeSshCwd

export function quotePosixShellArg (value) {
  const quote = '\''
  const escapedQuote = quote + '"' + quote + '"' + quote
  return quote + value.replace(/'/g, escapedQuote) + quote
}

export function createRestoreCwdCommand (cwd) {
  const safeCwd = sanitizeSshCwd(cwd)
  return safeCwd ? `cd -- ${quotePosixShellArg(safeCwd)}` : ''
}

// The shell setting is hand-entered config, so tolerate a quoted or padded
// executable path before deciding which shell we are looking at.
export function isPowerShellExecutable (shell = '') {
  const shellPath = String(shell || '').trim().replace(/^"|"$/g, '')
  return /(?:^|[/\\])(?:powershell|pwsh)(?:\.exe)?$/i.test(shellPath)
}

export function createWindowsRestoreCwdCommand (cwd, shell = '') {
  const safeCwd = sanitizeSshCwd(cwd)
  if (!safeCwd) {
    return ''
  }
  if (isPowerShellExecutable(shell)) {
    // -LiteralPath keeps `[`, `]` and `*` in a directory name from being read
    // as a wildcard; '' is PowerShell's escape for a literal single quote.
    return `Set-Location -LiteralPath '${safeCwd.replace(/'/g, "''")}'`
  }
  // Strip control chars already handled by sanitize; escape embedded double
  // quotes for CMD.
  const escaped = safeCwd.replace(/"/g, '""')
  return `cd /d "${escaped}"`
}

/**
 * The `cd <dir>` command for a terminal session, used when the user sends a
 * directory from the file panel to the terminal.
 *
 * A local session knows which shell it spawned, so it can emit syntax that
 * shell actually understands (PowerShell rejects CMD's `cd /d`). A remote tab
 * cannot: the far side's shell is unknown from here, so it keeps the CMD form.
 * Every branch quotes the path with the target shell's own rules - a directory
 * name is attacker-influenced (it can come out of an unpacked archive), so a
 * bare `cd "..."` would let `$(...)` and backticks run.
 *
 * Returns '' when the path is unusable. Callers must not fall back to
 * interpolating the raw path into a command.
 */
export function createCdCommand (dir, { remote = false, shell = '' } = {}) {
  const safeDir = sanitizeSshCwd(dir)
  if (!safeDir) {
    return ''
  }
  if (!/^[a-zA-Z]:\\/.test(safeDir)) {
    return `cd ${quotePosixShellArg(safeDir)}`
  }
  return remote
    ? `cd /d "${safeDir.replace(/"/g, '""')}"`
    : createWindowsRestoreCwdCommand(safeDir, shell)
}

export function shouldCaptureTerminalReloadState (tab, config = {}) {
  return !!config.restoreTerminalSessionOnReload && isRestorableTerminalTab(tab)
}

// Kept for backward compatibility - now covers all shell terminals
// (ssh, local, telnet, serial), not just ssh.
export function shouldCaptureSshReloadState (tab, config = {}) {
  return shouldCaptureTerminalReloadState(tab, config)
}

export function createSshReloadState ({ cwd, screen } = {}) {
  const safeCwd = sanitizeSshCwd(cwd)
  const safeScreen = typeof screen === 'string' ? screen : ''
  if (!safeCwd && !safeScreen) {
    return undefined
  }
  return {
    cwd: safeCwd,
    screen: safeScreen
  }
}

export const createTerminalReloadState = createSshReloadState

export function getAlternateBufferSnapshot (buffer) {
  if (!buffer || buffer.type !== 'alternate') {
    return ''
  }
  const lines = []
  for (let i = 0; i < buffer.length; i++) {
    lines.push(buffer.getLine(i)?.translateToString(true) || '')
  }
  while (lines.length && !lines[lines.length - 1]) {
    lines.pop()
  }
  return lines.join('\r\n')
}
