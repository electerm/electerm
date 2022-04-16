/**
 * extend store
 */

import keyControlPress from '../common/key-control-pressed'
import keyPressed from '../common/key-pressed'
import postMessage from '../common/post-msg'

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
        type
      } = e.data || {}
      if (type !== 'store-op') {
        return false
      }
      const {
        action,
        args
      } = e.data || {}
      return store[action](...args)
    },

    focus () {
      postMessage({
        type: 'focus'
      })
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
