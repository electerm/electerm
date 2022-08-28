/**
 * context menu related functions
 */

import postMessage from '../common/post-msg'
import {
  commonActions
} from '../common/constants'

export default Store => {
  Store.prototype.openContextMenu = function (data) {
    postMessage({
      data,
      type: commonActions.openContextMenu
    })
  }

  Store.prototype.closeContextMenu = function () {
    postMessage({
      action: commonActions.closeContextMenu
    })
  }
}
