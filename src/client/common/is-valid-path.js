/**
 * file path validation
 */

export default (pth) => {
  const sep = pth.includes('\\') || pth.includes(':')
    ? '\\'
    : '/'
  return window._require('path-validation')
    .isAbsolutePath(pth, sep)
}
