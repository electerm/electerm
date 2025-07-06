/**
 * smart resolve function
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */

export default function resolve (basePath, nameOrDot) {
  const hasWinDrive = (path) => /^[a-zA-Z]:/.test(path)
  const isWin = basePath.includes('\\') || nameOrDot.includes('\\') || hasWinDrive(basePath) || hasWinDrive(nameOrDot)
  const sep = isWin ? '\\' : '/'
  if (/^[a-zA-Z]:/.test(nameOrDot)) {
    return nameOrDot.replace(/^\//, '').replace(/\//g, sep)
  }
  if (nameOrDot.startsWith('/')) {
    return nameOrDot.replace(/\\/g, sep)
  }
  if (nameOrDot === '..') {
    const baseEndsWithSep = basePath.endsWith(sep)
    const parts = basePath.split(sep)
    if (parts.length > 1) {
      parts.pop()
      if (isWin && parts.length === 1) {
        return baseEndsWithSep ? '/' : parts.join(sep)
      }
      return parts.join(sep) || '/'
    }
    return '/'
  }
  const result = basePath.endsWith(sep) ? basePath + nameOrDot : basePath + sep + nameOrDot
  return isWin && result.length === 3 && result.endsWith(':\\') ? '/' : result
}

export const osResolve = (...args) => {
  return window.pre.resolve(...args)
}
