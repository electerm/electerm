/**
 * context menu related functions
 */

import postMessage from '../common/post-msg'
import {
  commonActions
} from '../common/constants'

export default store => {
  Object.assign(store, {
    // initContextEvent () {
    //   const dom = document.getElementById('outside-context')
    //   dom && dom.addEventListener('click', store.closeContextMenu)
    // },

    openContextMenu (data) {
      postMessage({
        data,
        type: commonActions.openContextMenu
      })
    },

    closeContextMenu () {
      postMessage({
        action: commonActions.closeContextMenu
      })
    }
  })
}
