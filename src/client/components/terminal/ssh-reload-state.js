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

export function createWindowsRestoreCwdCommand (cwd) {
  const safeCwd = sanitizeSshCwd(cwd)
  if (!safeCwd) {
    return ''
  }
  // Strip control chars already handled by sanitize; escape embedded double
  // quotes for cmd/powershell (`""` is accepted by both as a literal quote).
  const escaped = safeCwd.replace(/"/g, '""')
  return `cd /d "${escaped}"`
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
