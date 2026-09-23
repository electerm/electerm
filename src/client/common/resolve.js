/**
 * smart resolve function
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */

export const isWslPath = (path) => /^\\\\(?:wsl\$|wsl\.localhost)\\/.test(path)

export const isWslDistroRoot = (path) => {
  const trimmed = path.replace(/\\$/, '')
  return /^\\\\(?:wsl\$|wsl\.localhost)\\[^\\]+$/.test(trimmed)
}

export default function resolve (basePath, nameOrDot) {
  // Callers can hand this a value that is not a path yet (a session path that
  // is still loading, a missing tab option, ...). Reading `.includes` off it
  // used to throw and take the whole renderer down with a white screen, so
  // anything that is not a string is treated as an empty path here.
  const base = typeof basePath === 'string' ? basePath : ''
  const name = typeof nameOrDot === 'string' ? nameOrDot : ''
  const hasWinDrive = (path) => /^[a-zA-Z]:/.test(path)
  const isWin = base.includes('\\') || name.includes('\\') || hasWinDrive(base) || hasWinDrive(name)
  const sep = isWin ? '\\' : '/'
  if (/^[a-zA-Z]:/.test(name)) {
    return name.replace(/^\//, '').replace(/\//g, sep)
  }
  if (name.startsWith('/')) {
    return name.replace(/\\/g, sep)
  }
  if (name.startsWith('\\\\')) {
    return name
  }
  if (name === '..') {
    if (isWslDistroRoot(base)) {
      return '/'
    }
    const baseEndsWithSep = base.endsWith(sep)
    const parts = base.split(sep)
    if (parts.length > 1) {
      parts.pop()
      if (isWin && parts.length === 1) {
        return baseEndsWithSep ? '/' : parts.join(sep)
      }
      return parts.join(sep) || '/'
    }
    return '/'
  }
  if (isWslDistroRoot(base) && !base.endsWith(sep)) {
    return base + sep + name
  }
  const result = base.endsWith(sep) ? base + name : base + sep + name
  return isWin && result.length === 3 && result.endsWith(':\\') ? '/' : result
}

export const osResolve = (...args) => {
  return window.pre.resolve(...args)
}
