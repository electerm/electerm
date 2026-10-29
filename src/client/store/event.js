/**
 * extend store
 */

import { refs } from '../components/common/ref'
import { recoverVisibleTerminals } from '../components/terminal/terminal-render-recovery.mjs'

export default Store => {
  Store.prototype.focus = function () {
    window.focused = true
    const { store } = window
    const terminalIds = [
      store.activeTabId0,
      store.activeTabId1,
      store.activeTabId2,
      store.activeTabId3,
      store.activeTabId
    ]
    recoverVisibleTerminals(
      terminalIds,
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
