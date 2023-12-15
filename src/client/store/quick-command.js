/**
 * quick command related functions
 */

import {
  settingMap,
  terminalActions
} from '../common/constants'
import postMessage from '../common/post-msg'

export default Store => {
  Store.prototype.setQuickCommands = function (list) {
    return window.store.setItems(settingMap.quickCommands, list)
  }

  Store.prototype.addQuickCommand = function (
    qm
  ) {
    window.store.addItem(qm, settingMap.quickCommands)
  }

  Store.prototype.editQuickCommand = function (id, update) {
    window.store.editItem(id, update, settingMap.quickCommands)
  }

  Store.prototype.delQuickCommand = function ({ id }) {
    window.store.delItem({ id }, settingMap.quickCommands)
  }

  Store.prototype.runQuickCommand = function (cmd, inputOnly = false) {
    const { activeTerminalId } = window.store
    postMessage({
      action: terminalActions.quickCommand,
      cmd,
      inputOnly,
      activeSplitId: activeTerminalId
    })
  }
}
