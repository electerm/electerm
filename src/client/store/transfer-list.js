/**
 * file transfer list related functions
 */
const { assign } = Object

export default Store => {
  Store.prototype.handleTransferTab = function (tab) {
    window.store.transferTab = tab
  }

  Store.prototype.updateTransfer = function (id, update) {
    const { fileTransfers } = window.store
    const index = fileTransfers.findIndex(t => t.id === id)
    if (index < 0) {
      return
    }
    assign(fileTransfers[index], update)
  }

  Store.prototype.addTransferList = function (items) {
    const { fileTransfers } = window.store
    fileTransfers.push(...items)
  }

  Store.prototype.toggleTransfer = function (itemId) {
    const { fileTransfers } = window.store
    const index = fileTransfers.findIndex(t => t.id === itemId)
    if (index < 0) {
      return
    }
    fileTransfers[index].pausing = !fileTransfers[index].pausing
  }

  Store.prototype.pauseAll = function () {
    const { fileTransfers } = window.store
    window.store.pauseAllTransfer = true
    const len = fileTransfers.length
    for (let i = 0; i < len; i++) {
      fileTransfers[i].pausing = true
    }
  }

  Store.prototype.resumeAll = function () {
    const { fileTransfers } = window.store
    window.store.pauseAllTransfer = false
    const len = fileTransfers.length
    for (let i = 0; i < len; i++) {
      fileTransfers[i].pausing = false
    }
  }

  Store.prototype.cancelAll = function () {
    const { fileTransfers } = window.store
    const len = fileTransfers.length
    for (let i = len - 1; i >= 0; i--) {
      fileTransfers[i].cancel = true
      fileTransfers.splice(i, 1)
    }
  }

  Store.prototype.cancelTransfer = function (itemId) {
    const { fileTransfers } = window.store
    const index = fileTransfers.findIndex(t => t.id === itemId)
    if (index < 0) {
      return
    }
    fileTransfers[index].cancel = true
    fileTransfers.splice(index, 1)
  }

  Store.prototype.skipAllTransfersSinceIndex = function (index) {
    window.store.fileTransfers.splice(index)
  }

  Store.prototype.updateTransfersFromIndex = function (index, update) {
    const { fileTransfers } = window.store
    if (index < 0 || index >= fileTransfers.length) {
      return
    }
    const len = fileTransfers.length
    for (let i = index; i < len; i++) {
      assign(fileTransfers[i], update)
    }
  }

  // Add a new method to find index by ID and then update
  Store.prototype.updateTransfersFromId = function (id, update) {
    const { fileTransfers } = window.store
    const index = fileTransfers.findIndex(t => t.id === id)
    if (index < 0) {
      return
    }
    window.store.updateTransfersFromIndex(index, update)
  }
}
