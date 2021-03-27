/**
 * file path validation
 */

import { isWinDrive } from '../../app/common/is-win-drive'

export default (pth) => {
  const sep = pth.includes('\\') || pth.includes(':')
    ? '\\'
    : '/'
  let path = pth
  if (isWinDrive(path)) {
    path = path + '\\'
  }
  return window.pre.isAbsolutePath(path, sep)
}
