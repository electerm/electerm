function getType (item) {
  if (!item.host) {
    return 'addressBookmarksLocal'
  }
  return item.isGlobal ? 'addressBookmarksGlobal' : 'addressBookmarks'
}

export default Store => {
  Store.prototype.addAddressBookmark = (item) => {
    return window.store.addItem(item, getType(item))
  }

  Store.prototype.delAddressBookmark = (item) => {
    return window.store.delItem(item, getType(item))
  }

  Store.prototype.listAddressBookmark = () => {
    const { store } = window
    return [
      ...store.addressBookmarksLocal,
      ...store.addressBookmarksGlobal.sort((a, b) => {
        return a.host > b.host ? 1 : -1
      }),
      ...store.addressBookmarks.sort((a, b) => {
        return a.host > b.host ? 1 : -1
      })
    ]
  }
}
