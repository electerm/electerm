/**
 * transfer history related functions
 */

import {
  maxTransferHistory
} from '../common/constants'

export default store => {
  store.openTransferHistory = () => {
    store.transferHistoryModalVisible = true
  }

  store.closeTransferHistory = () => {
    store.transferHistoryModalVisible = false
  }

  store.clearTransferHistory = () => {
    store.storeAssign({
      transferHistory: [],
      transferHistoryModalVisible: false
    })
  }

  store.addTransferHistory = (item) => {
    const { transferHistory } = store
    transferHistory.unshift(item)
    store.transferHistory = transferHistory.slice(0, maxTransferHistory)
  }
}
