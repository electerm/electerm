/**
 * sessions not proper closed related functions
 */

import { isMac, terminalActions } from '../common/constants'
import { debounce } from 'lodash-es'
import postMsg from '../common/post-msg'

export default Store => {
  Store.prototype.onMouseWheel = function (event) {
    if (
      (isMac && event.metaKey) ||
      (!isMac && event.ctrlKey)
    ) {
      event.stopPropagation()
      if (window.store.inActiveTerminal) {
        window.store.zoomTerminal(event.wheelDeltaY)
      } else {
        const plus = event.wheelDeltaY > 0 ? 0.2 : -0.2
        window.store.zoom(plus, true)
      }
    }
  }

  Store.prototype.zoomTerminal = debounce(function (delta) {
    postMsg({
      action: terminalActions.zoom,
      zoomValue: delta > 0 ? 1 : -1,
      activeSplitId: window.store.activeTerminalId
    })
  }, 500)
}
