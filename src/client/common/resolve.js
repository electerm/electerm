/**
 * smart resolve function
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */

export default (basePath, nameOrDot) => {
  const sep = (basePath.includes('\\') ||
  basePath.includes(':\\') ||
  /^[a-z]+:$/i.test(basePath) ||
  /^[a-z]+:$/i.test(nameOrDot)
  )
    ? '\\'
    : '/'
  if (nameOrDot === '..') {
    const arr = basePath.split(sep)
    const { length } = arr
    if (length === 1) {
      return '/'
    }
    const res = arr.slice(0, length - 1).join(sep)
    return res || '/'
  }
  const pre = (nameOrDot.includes(':\\') || /^[a-z]+:$/i.test(nameOrDot)) && basePath === '/'
    ? ''
    : basePath
  const mid = (basePath.endsWith(sep) ? '' : sep)
  let ff = pre + mid + nameOrDot
  if (/^\\[a-z]+:$/i.test(ff)) {
    ff = ff.slice(1)
  }
  return ff
}

export const osResolve = (...args) => {
  return window.pre.resolve(...args)
}
