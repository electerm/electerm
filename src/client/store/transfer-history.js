/**
 * transfer history related functions
 */

import {
  maxTransferHistory
} from '../common/constants'

export default store => {
  store.clearTransferHistory = () => {
    store.transferHistory = []
  }

  store.getTransferHistory = () => {
    return store.getItems('transferHistory')
  }

  store.addTransferHistory = (item) => {
    const transferHistory = store.getItems('transferHistory')
    transferHistory.unshift(item)
    store.setItems(
      'transferHistory',
      transferHistory.slice(0, maxTransferHistory)
    )
  }
}
