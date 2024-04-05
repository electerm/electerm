import { findIndex } from 'lodash-es'
export default Store => {
  Store.prototype.handleTransferTab = function (tab) {
    window.store.transferTab = tab
  }

  // should update any item with same id in oldList from list array, should add any new item from list array to oldList, should remove any item with same id and sessionId in oldList but not in list array
  Store.prototype.setTransfers = function (list, _sessId) {
    const { store } = window
    let oldList = store.getTransfers()
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
}
