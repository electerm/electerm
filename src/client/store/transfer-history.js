/**
 * transfer history related functions
 */

import {
  maxTransferHistory
} from '../common/constants'

export default Store => {
  Store.prototype.clearTransferHistory = function () {
    window.store.setItems('transferHistory', [])
  }

  Store.prototype.getTransferHistory = function () {
    return window.store.getItems('transferHistory')
  }

  Store.prototype.addTransferHistory = function (item) {
    const { store } = window
    const transferHistory = store.getItems('transferHistory')
    transferHistory.unshift(item)
    store.setItems(
      'transferHistory',
      transferHistory.slice(0, maxTransferHistory)
    )
  }
}
