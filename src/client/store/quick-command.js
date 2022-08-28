/**
 * quick command related functions
 */

import {
  settingMap
} from '../common/constants'

export default Store => {
  Store.prototype.getQuickCommands = function () {
    return window.store.getItems(settingMap.quickCommands)
  }

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
}
