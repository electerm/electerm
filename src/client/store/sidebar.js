/**
 * sidebar
 */

import {
  openedSidebarKey,
  sidebarPinnedKey,
  bookmarkBarVisibleKey
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

  // Single entry point for opening/closing the left side panel from the
  // sidebar icons. The panel is a toggle: call again to close. It also
  // re-centers the pin behaviour so every open/close transition goes
  // through this one method.
  Store.prototype.openLeftSidePanel = function (field = 'bookmarks') {
    const { store } = window
    // A pinned panel is already open, so there is nothing to toggle — except
    // on mobile, where pinning is not a reachable mode (no pin control) and
    // the panel is a full-width overlay. Honouring a stale desktop pin here
    // would leave the bookmark button dead on arrival.
    if (store.pinned && !store.isMobile) {
      return
    }
    store.setOpenedSideBar(store.openedSideBar ? '' : field)
  }

  // The bookmark bar is a second way to show the same bookmarks, not a
  // replacement for the tree: a user may keep the bar for quick access and
  // still open the tree to manage them, the way chrome keeps the bar while the
  // bookmark manager is open. So this does not touch openedSideBar.
  Store.prototype.toggleBookmarkBar = function () {
    const { store } = window
    const willShow = !store._bookmarkBarVisible
    store._bookmarkBarVisible = willShow
    ls.setItem(bookmarkBarVisibleKey, willShow ? 'true' : 'false')
  }

  Store.prototype.handlePin = function (pinned) {
    const { store } = window
    const current = !store.pinned
    ls.setItem(sidebarPinnedKey, current + '')
    store.pinned = current
    if (!current) {
      store.setOpenedSideBar('')
    }
  }

  Store.prototype.handleCloseSidebar = function () {
    const { store } = window
    if (store.pinned) {
      ls.setItem(sidebarPinnedKey, 'false')
      store.pinned = false
    }
    store.setOpenedSideBar('')
  }

  Store.prototype.handleSidebarPanelTab = function (tab) {
    window.store.sidebarPanelTab = tab
  }

  Store.prototype.setOpenedSideBar = function (v) {
    ls.setItem(openedSidebarKey, v)
    window.store.openedSideBar = v
  }
}
