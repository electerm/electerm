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
  if (Array.from(cwd).some(char => char < ' ' || char === '\x7f')) {
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
function shellName (shell) {
  const path = String(shell || '').trim().replace(/^"|"$/g, '')
  if (/(?:^|[/\\])(?:system32|sysnative|syswow64|wsl)[/\\]bash(?:\.exe)?$/i.test(path)) {
    return 'wsl'
  }
  return path.split(/[/\\]/).pop().toLowerCase().replace(/\.exe$/, '')
}

export function isPowerShellExecutable (shell = '') {
  const name = shellName(shell)
  return name === 'powershell' || name === 'pwsh'
}

// Keep path characters out of PowerShell source, including typographic quotes.
function powerShellCdCommand (dir) {
  const bytes = new TextEncoder().encode(dir)
  const encoded = btoa(String.fromCharCode(...bytes))
  return `Set-Location -LiteralPath ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encoded}')))`
}

function cmdCdCommand (dir) {
  // Quotes delimit the argument. Paired percent signs and delayed expansion
  // can interpolate environment variables even inside double quotes.
  return /["!]|%[^%]*%/.test(dir) ? '' : `cd /d "${dir}"`
}

/**
 * Build a directory change for the local Windows shell used by the file panel
 * or startup queue. Directory names may come from an untrusted source.
 * An empty result means callers must skip the command. Never interpolate
 * the raw directory as a fallback.
 */
export function createWindowsCdCommand (cwd, shell = '') {
  const safeCwd = sanitizeSshCwd(cwd)
  if (!safeCwd) {
    return ''
  }
  if (isPowerShellExecutable(shell)) {
    return powerShellCdCommand(safeCwd)
  }
  const name = shellName(shell)
  if (name === 'cmd') {
    return cmdCdCommand(safeCwd)
  }

  const drive = /^([a-z]):[\\/]/i.exec(safeCwd)
  if (name === 'wsl') {
    // The launcher does not identify the distribution's interactive shell.
    // Limit accepted paths before quoting them for a POSIX shell.
    const path = drive
      ? '/mnt/' + drive[1].toLowerCase() + '/' + safeCwd.slice(3).replace(/\\/g, '/')
      : safeCwd
    return /^\/[\p{L}\p{N} /._()[\]+=#,@&';~-]*$/u.test(path) ? createRestoreCwdCommand(path) : ''
  }
  if (['bash', 'sh', 'zsh'].includes(name)) {
    const path = drive || safeCwd.startsWith('\\\\') ? safeCwd.replace(/\\/g, '/') : safeCwd
    return createRestoreCwdCommand(path)
  }
  return ''
}

// File-panel navigation and startup share the local Windows shell policy.
export function createCdCommand (dir, { remote = false, shell = '', windows = false } = {}) {
  const safeDir = sanitizeSshCwd(dir)
  if (!safeDir) {
    return ''
  }
  const drivePath = /^[a-z]:[\\/]/i.test(safeDir)
  if (!remote && (windows || drivePath || isPowerShellExecutable(shell))) {
    return createWindowsCdCommand(safeDir, shell)
  }
  if (remote && drivePath) {
    // The remote shell may interpret substitutions or smart double quotes.
    return /[$`\u201c-\u201f]/.test(safeDir) ? '' : cmdCdCommand(safeDir)
  }
  return `cd ${quotePosixShellArg(safeDir)}`
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
