/**
 * sidebar
 */

import {
  settingMap
} from '../common/constants'

export default store => {
  Object.assign(store, {
    expandBookmarks () {
      store.storeAssign({
        openedCategoryIds: store.getItems('bookmarkGroups').map(g => g.id)
      })
    },

    collapseBookmarks () {
      store.storeAssign({
        openedCategoryIds: []
      })
    },

    setOpenedSideBar (bar) {
      store.openedSideBar = bar
    },

    pin (pinned) {
      store.pinned = !store.pinned
    },

    onClickBookmark () {
      store.onNewSsh()
    },

    onClickHistory () {
      store.onChangeTab(settingMap.history)
    }
  })
}
