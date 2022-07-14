/**
 * extend store
 */

import keyControlPress from '../common/key-control-pressed'
import keyPressed from '../common/key-pressed'
import postMessage from '../common/post-msg'
import { commonActions } from '../common/constants'

export default store => {
  Object.assign(store, {
    initShortcuts () {
      window.addEventListener('keydown', e => {
        if (keyControlPress(e) && keyPressed(e, 'w')) {
          e.stopPropagation()
          store.delTab({
            id: store.currentTabId
          })
          if (!store.tabs.length) {
            store.addTab()
          }
        }
      })
    },

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
        store[action](...args)
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

    triggerReszie () {
      window.dispatchEvent(new window.Event('resize'))
    },

    toggleTermFullscreen (terminalFullScreen) {
      store.terminalFullScreen = terminalFullScreen
      setTimeout(store.triggerReszie, 500)
    }
  })
}
