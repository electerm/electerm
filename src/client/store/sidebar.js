/**
 * sidebar
 */

import {
  settingMap,
  openedSidebarKey,
  sidebarPinnedKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'

export default store => {
  Object.assign(store, {
    expandBookmarks () {
      store.storeAssign({
        openedCategoryIds: store.getBookmarkGroups().map(g => g.id)
      })
    },

    collapseBookmarks () {
      store.storeAssign({
        openedCategoryIds: []
      })
    },

    setOpenedSideBar (bar) {
      ls.setItem(openedSidebarKey, bar)
      store.openedSideBar = bar
    },

    pin (pinned) {
      const current = !store.pinned
      ls.setItem(sidebarPinnedKey, current + '')
      store.pinned = current
    },

    onClickBookmark () {
      store.onNewSsh()
    },

    onClickHistory () {
      store.onChangeTab(settingMap.history)
    }
  })
}
