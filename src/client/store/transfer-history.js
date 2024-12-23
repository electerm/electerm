/**
 * transfer history related functions
 */

export default Store => {
  Store.prototype.clearTransferHistory = function () {
    window.store.transferHistory = []
  }

  Store.prototype.getTransferHistory = function () {
    return window.store.transferHistory
  }

  Store.prototype.addTransferHistory = function (item) {
    window.store.transferHistory.unshift(item)
  }
}
