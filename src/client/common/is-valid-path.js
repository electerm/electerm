/**
 * file path validation
 */

export default (pth) => {
  const sep = pth.includes('\\') || pth.includes(':')
    ? '\\'
    : '/'
  return window.pre.isAbsolutePath(pth, sep)
}
