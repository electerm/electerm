/**
 * extend store
 */

import postMessage from '../common/post-msg'
import { commonActions } from '../common/constants'

export default store => {
  Object.assign(store, {
    initStoreEvents () {
      window.addEventListener('message', store.onStoreEvent)
    },

    onStoreEvent (e) {
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
    },

    focus () {
      window.focused = true
      postMessage({
        type: 'focus'
      })
    },

    onBlur () {
      window.focused = false
    },

    selectall () {
      document.activeElement &&
      document.activeElement.select &&
      document.activeElement.select()
      postMessage({
        event: 'selectall',
        id: store.activeTerminalId
      })
    },

    triggerResize () {
      window.dispatchEvent(new window.Event('resize'))
    },

    toggleTermFullscreen (terminalFullScreen) {
      store.terminalFullScreen = terminalFullScreen
      setTimeout(store.triggerResize, 500)
    }
  })
}
