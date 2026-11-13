/**
 * Switching a watcher on or off from a filter control.
 *
 * The watcher belongs to the bookmark, and the open tab only holds a copy taken
 * when the session started, so both have to be written: the bookmark for the
 * next connection (and the bookmark form), the tab for what is on screen now.
 */
import { settingMap } from '../../common/constants'
import { toggleWatcher } from '../../common/custom-watcher'

export function setWatcherEnabled (tab, id) {
  if (!tab) {
    return
  }
  const watchers = toggleWatcher(tab.watchers, id)
  tab.watchers = watchers
  // a tab opened from history or by MCP has no bookmark behind it
  if (!tab.srcId) {
    return
  }
  window.store.editItem(tab.srcId, { watchers }, settingMap.bookmarks)
}
