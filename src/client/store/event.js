/**
 * extend store
 */

import postMessage from '../common/post-msg'
import { commonActions } from '../common/constants'

export default Store => {
  Store.prototype.initStoreEvents = function () {
    window.addEventListener('message', window.store.onStoreEvent)
  }

  Store.prototype.onStoreEvent = function (e) {
    const { store } = window
    const {
      action
    } = e.data || {}
    if (action !== commonActions.updateStore) {
      return false
    }
    const {
      func,
      prop,
      value,
      args = []
    } = e.data || {}
    if (func) {
      store[func](...args)
    } else if (prop) {
      store[prop] = value
    }
  }

  Store.prototype.focus = function () {
    window.focused = true
    postMessage({
      type: 'focus'
    })
  }

  Store.prototype.blur = function () {
    window.focused = false
    window.pre.runSync('windowMove', false)
    postMessage({
      type: 'blur'
    })
  }

  Store.prototype.onBlur = function () {
    window.focused = false
    window.pre.runSync('windowMove', false)
  }

  Store.prototype.selectall = function () {
    document.activeElement &&
    document.activeElement.select &&
    document.activeElement.select()
    postMessage({
      event: 'selectall',
      id: window.store.activeTabId
    })
  }

  Store.prototype.triggerResize = function () {
    window.store.resizeTrigger = window.store.resizeTrigger ? 0 : 1
    window.dispatchEvent(new Event('resize'))
  }

  Store.prototype.toggleTermFullscreen = function (terminalFullScreen) {
    window.store.terminalFullScreen = terminalFullScreen
    setTimeout(window.store.triggerResize, 500)
  }
}
