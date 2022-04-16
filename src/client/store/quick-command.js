/**
 * quick command related functions
 */

import {
  settingMap
} from '../common/constants'

export default store => {
  Object.assign(store, {
    getQuickCommands () {
      return store.getItems(settingMap.quickCommands)
    },

    setQuickCommands (list) {
      return store.setItems(settingMap.quickCommands, list)
    },

    addQuickCommand (
      qm
    ) {
      store.addItem(qm, settingMap.quickCommands)
    },

    editQuickCommand (id, update) {
      store.editItem(id, update, settingMap.quickCommands)
    },

    delQuickCommand ({ id }) {
      store.delItem({ id }, settingMap.quickCommands)
    }
  })
}
