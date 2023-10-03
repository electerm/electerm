export default Store => {
  Store.prototype.handleTransferTab = function (tab) {
    window.store.transferTab = tab
  }
  Store.prototype.setTransfers = function (list) {
    return window.store.setItems('fileTransfers', list)
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
