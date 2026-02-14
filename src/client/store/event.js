/**
 * extend store
 */

import { refs } from '../components/common/ref'

export default Store => {
  Store.prototype.focus = function () {
    window.focused = true
    refs.get('term-' + window.store.activeTabId)?.term?.focus()
  }

  Store.prototype.blur = function () {
    window.focused = false
    if (window.store.shouldSendWindowMove) {
      window.pre.runSync('windowMove', false)
    }
    refs.get('term-' + window.store.activeTabId)?.term?.blur()
  }

  Store.prototype.onBlur = function () {
    window.focused = false
    if (window.store.shouldSendWindowMove) {
      window.pre.runSync('windowMove', false)
    }
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
