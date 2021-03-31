/**
 * extend store
 */

import keyControlPress from '../common/key-control-pressed'
import keyPressed from '../common/key-pressed'

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
    focus () {
      window.postMessage({
        type: 'focus'
      }, '*')
    },
    selectall () {
      document.activeElement &&
      document.activeElement.select &&
      document.activeElement.select()
      window.postMessage({
        event: 'selectall',
        id: store.activeTerminalId
      }, '*')
    },

    triggerReszie () {
      window.dispatchEvent(new window.Event('resize'))
    },

    toggleTermFullscreen (terminalFullScreen) {
      store.terminalFullScreen = terminalFullScreen
      setTimeout(store.triggerReszie, 200)
    }
  })
}
