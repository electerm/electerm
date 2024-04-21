import { findIndex } from 'lodash-es'
export default Store => {
  Store.prototype.handleTransferTab = function (tab) {
    window.store.transferTab = tab
  }

  Store.prototype.setTransfers = function (list, _sessId) {
    const { store } = window
    let oldList = store.fileTransfers
    const sessId = _sessId || list[0].sessionId
    const arr2 = oldList.filter(t => {
      return t.sessionId === sessId
    })
    const idsToRm = arr2.reduce((prev, curr) => {
      if (!list.find(l => l.id === curr.id)) {
        prev.push(curr.id)
      }
      return prev
    }, [])
    if (idsToRm.length) {
      oldList = oldList.filter(t => {
        return !idsToRm.includes(t.id)
      })
    }
    for (const ntm of list) {
      const index = findIndex(oldList, t => {
        return t.id === ntm.id
      })
      if (index >= 0) {
        oldList[index] = ntm
        continue
      } else {
        oldList.unshift(ntm)
      }
    }
    store.setItems('fileTransfers', oldList)
  }
  Store.prototype.getTransfers = function () {
    return window.store.getItems('fileTransfers')
  }
  Store.prototype.delTransfers = function (ids) {
    return window.store.delItems(ids, 'fileTransfers')
  }
  Store.prototype.editTransfer = function (id, updates) {
    return window.store.editItem(id, updates, 'fileTransfers')
  }
  Store.prototype.addTransfers = function (objs) {
    return window.store.addItems(objs, 'fileTransfers')
  }
  Store.prototype.setFileTransfers = function (objs) {
    return window.store.setState('fileTransfers', objs)
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
    const { store } = window
    store.setFileTransfers(store.fileTransfers.map(t => {
      t.cancel = true
      return t
    }))
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
