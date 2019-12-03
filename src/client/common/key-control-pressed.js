/**
 * check event if control/meta key pressed
 */

import { isMac } from './constants'
export default e => {
  if (e.metaKey && e.ctrlKey) {
    return false
  }
  return isMac
    ? e.metaKey
    : e.ctrlKey
}
