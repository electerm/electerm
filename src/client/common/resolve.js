
/**
 * smart resolve function
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */
export default (basePath, nameOrDot) => {
  let sep = basePath.includes('\\') || basePath.includes(':')
    ? '\\'
    : '/'
  if (nameOrDot === '..') {
    let arr = basePath.split(sep)
    let {length} = arr
    if (length === 1) {
      return basePath
    }
    let res = arr.slice(0, length - 1).join(sep)
    return res ? res : '/'
  }
  return basePath +
    (basePath === '/' ? '' : sep) +
    nameOrDot
}
