
export default store => {
  store.openTransferList = () => {
    store.setOpenedSideBar('file-transfer')
  }
  store.handleTransferTab = tab => {
    store.transferTab = tab
  }
  store.setTransfers = (list) => {
    return store.setItems('fileTransfers', list)
  }
  store.getTransfers = () => {
    return store.getItems('fileTransfers')
  }
  store.delTransfers = (ids) => {
    return store.delItems(ids, 'fileTransfers')
  }
  store.editTransfer = (id, updates) => {
    return store.editItem(id, updates, 'fileTransfers')
  }
  store.addTransfers = objs => {
    return store.addItems(objs, 'fileTransfers')
  }
}
