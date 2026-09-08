const maxCwdLength = 4096

export function isSshTab (tab = {}) {
  return !!tab.host && (!tab.type || tab.type === 'ssh')
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

export function quotePosixShellArg (value) {
  const quote = '\''
  const escapedQuote = quote + '"' + quote + '"' + quote
  return quote + value.replace(/'/g, escapedQuote) + quote
}

export function createRestoreCwdCommand (cwd) {
  const safeCwd = sanitizeSshCwd(cwd)
  return safeCwd ? `cd -- ${quotePosixShellArg(safeCwd)}` : ''
}

export function shouldCaptureSshReloadState (tab, config = {}) {
  return !!config.restoreTerminalSessionOnReload && isSshTab(tab)
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
