/**
 * check event if control/meta key pressed
 */

import {isMac} from './constants'
export default e => {
  return isMac
    ? e.metaKey
    : e.ctrlKey
}
