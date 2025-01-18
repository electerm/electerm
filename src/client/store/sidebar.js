/**
 * sidebar
 */

import {
  openedSidebarKey,
  sidebarPinnedKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'

export default Store => {
  Store.prototype.expandBookmarks = function () {
    const { store } = window
    window.store.expandedKeys = store.getBookmarkGroupsTotal().map(g => g.id)
  }

  Store.prototype.collapseBookmarks = function () {
    const { store } = window
    store.expandedKeys = []
  }

  Store.prototype.handlePin = function (pinned) {
    const { store } = window
    const current = !store.pinned
    ls.setItem(sidebarPinnedKey, current + '')
    store.pinned = current
  }

  Store.prototype.onClickBookmark = function () {
    window.store.onNewSsh()
  }

  Store.prototype.handleSidebarPanelTab = function (tab) {
    window.store.sidebarPanelTab = tab
  }

  Store.prototype.setOpenedSideBar = function (v) {
    ls.setItem(openedSidebarKey, v)
    window.store.openedSideBar = v
  }
}
