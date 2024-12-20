import { findIndex } from 'lodash-es'
export default Store => {
  Store.prototype.handleTransferTab = function (tab) {
    window.store.transferTab = tab
  }

  Store.prototype.editTransfer = function (id, updates) {
    return window.store.editItem(id, updates, 'fileTransfers')
  }
  Store.prototype.addTransfers = function (objs) {
    return window.store.addItems(objs, 'fileTransfers')
  }
  Store.prototype.setFileTransfers = function (objs) {
    return window.store.setState('fileTransfers', objs.filter(d => !d.cancel))
  }
  Store.prototype.addTransferList = function (objs) {
    const { store } = window
    store.setFileTransfers([
      ...store.fileTransfers,
      ...objs
    ])
  }
  Store.prototype.toggleTransfer = function (itemId) {
    const { store } = window
    const { fileTransfers } = store
    const index = findIndex(fileTransfers, t => t.id === itemId)
    if (index < 0) {
      return
    }
    fileTransfers[index].pausing = !fileTransfers[index].pausing
    store.setFileTransfers(fileTransfers)
  }

  Store.prototype.pauseAll = function () {
    const { store } = window
    store.pauseAllTransfer = true
    store.setFileTransfers(store.fileTransfers.map(t => {
      t.pausing = true
      return t
    }))
  }
  Store.prototype.resumeAll = function () {
    const { store } = window
    store.pauseAllTransfer = false
    store.setFileTransfers(store.fileTransfers.map(t => {
      t.pausing = false
      return t
    }))
  }
  Store.prototype.cancelAll = function () {
    const arr = document.querySelectorAll('.sftp-transport .transfer-control-cancel')
    arr.forEach(d => {
      d.click()
    })
  }
  Store.prototype.cancelTransfer = function (itemId) {
    const { store } = window
    const { fileTransfers } = store
    const index = findIndex(fileTransfers, t => t.id === itemId)
    if (index < 0) {
      return
    }
    fileTransfers[index].cancel = true
    store.setFileTransfers(fileTransfers)
  }
}
