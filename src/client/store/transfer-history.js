/**
 * transfer history related functions
 */

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
      transferHistory
    )
  }
}
