/**
 * sidebar
 */

import {
  settingMap,
  openedSidebarKey,
  sidebarPinnedKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'

export default Store => {
  Store.prototype.expandBookmarks = function () {
    const { store } = window
    store.storeAssign({
      openedCategoryIds: store.getBookmarkGroups().map(g => g.id)
    })
  }

  Store.prototype.collapseBookmarks = function () {
    window.store.storeAssign({
      openedCategoryIds: []
    })
  }

  Store.prototype.setOpenedSideBar = function (bar) {
    ls.setItem(openedSidebarKey, bar)
    window.store.openedSideBar = bar
  }

  Store.prototype.pin = function (pinned) {
    const { store } = window
    const current = !store.pinned
    ls.setItem(sidebarPinnedKey, current + '')
    store.pinned = current
  }

  Store.prototype.onClickBookmark = function () {
    window.store.onNewSsh()
  }

  Store.prototype.onClickHistory = function () {
    window.store.onChangeTab(settingMap.history)
  }
}
