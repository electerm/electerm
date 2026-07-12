/**
 * check event if control/meta key pressed
 */

import { isMacJs } from './constants'
export default e => {
  if (e.metaKey && e.ctrlKey) {
    return false
  }
  return isMacJs
    ? e.metaKey
    : e.ctrlKey
}
