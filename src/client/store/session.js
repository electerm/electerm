/**
 * sessions not proper closed related functions
 */

import { terminalActions } from '../common/constants'
import { debounce } from 'lodash-es'
import postMsg from '../common/post-msg'

export default Store => {
  Store.prototype.zoomTerminal = debounce(function (delta) {
    postMsg({
      action: terminalActions.zoom,
      zoomValue: delta > 0 ? 1 : -1,
      activeTabId: window.store.activeTabId
    })
  }, 500)
}
