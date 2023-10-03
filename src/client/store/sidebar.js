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
    window.store.setState(
      'expandedKeys',
      store.getBookmarkGroupsTotal().map(g => g.id)
    )
  }

  Store.prototype.collapseBookmarks = function () {
    const { store } = window
    store.setState(
      'expandedKeys',
      []
    )
  }

  Store.prototype.setOpenedSideBar = function (bar) {
    ls.setItem(openedSidebarKey, bar)
    window.store.openedSideBar = bar
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

  Store.prototype.onClickHistory = function () {
    window.store.handleChangeSettingTab(settingMap.history)
  }
}
