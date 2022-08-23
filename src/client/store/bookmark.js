/**
 * bookmark
 */

export default Store => {
  Store.prototype.getSerials = async function () {
    const { store } = window
    store.loaddingSerials = true
    const res = await window.pre.runGlobalAsync('listSerialPorts')
      .catch(store.onError)
    if (res) {
      store._serials = JSON.stringify(res)
    }
    store.loaddingSerials = false
  }
  Store.prototype.getBookmarks = function () {
    return window.store.getItems('bookmarks')
  }
  Store.prototype.setBookmarks = function (items) {
    return window.store.setItems('bookmarks', items)
  }
}
