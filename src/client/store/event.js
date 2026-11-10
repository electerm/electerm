/**
 * extend store
 */

import { refs } from '../components/common/ref'
import { recoverVisibleTerminals } from '../components/terminal/terminal-render-recovery.mjs'

export default Store => {
  Store.prototype.focus = function () {
    window.focused = true
    const { store } = window
    // Every pane keeps its own current tab in `activeTabId<batch>`, and the
    // number of batches follows the layout, so they are derived instead of
    // listing a fixed 0..3 (a stale literal silently stops covering panes as
    // soon as the pane count changes).
    const batchTabIds = Object.keys(store)
      .filter(key => /^activeTabId\d+$/.test(key))
      .map(key => store[key])
    recoverVisibleTerminals(
      [...batchTabIds, store.activeTabId],
      id => refs.get('term-' + id),
      store.activeTabId
    )
  }

  Store.prototype.blur = function () {
    window.focused = false
    refs.get('term-' + window.store.activeTabId)?.term?.blur()
  }

  Store.prototype.onBlur = function () {
    window.focused = false
  }

  Store.prototype.selectall = function () {
    document.activeElement &&
    document.activeElement.select &&
    document.activeElement.select()
    refs.get('term-' + window.store.activeTabId)?.term?.selectAll()
  }

  Store.prototype.triggerResize = function () {
    window.store.resizeTrigger = window.store.resizeTrigger ? 0 : 1
    window.dispatchEvent(new Event('resize'))
  }

  Store.prototype.toggleSessFullscreen = function (fullscreen) {
    window.store.fullscreen = fullscreen
    setTimeout(window.store.triggerResize, 500)
  }
}
