
/**
 * smart resolve function
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */
export default (basePath, nameOrDot) => {
  const sep = basePath.includes('\\') || basePath.includes(':')
    ? '\\'
    : '/'
  if (nameOrDot === '..') {
    const arr = basePath.split(sep)
    const { length } = arr
    if (length === 1) {
      return basePath
    }
    const res = arr.slice(0, length - 1).join(sep)
    return res || '/'
  }
  return basePath +
    (basePath.endsWith(sep) ? '' : sep) +
    nameOrDot
}

export const osResolve = (...args) => {
  return window._require('path').resolve(...args)
}
