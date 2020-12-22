/**
 * sidebar
 */

export default store => {
  Object.assign(store, {
    expandBookmarks () {
      store.storeAssign({
        openedCategoryIds: store.bookmarkGroups.map(g => g.id)
      })
    },

    collapseBookmarks () {
      store.storeAssign({
        openedCategoryIds: []
      })
    },

    pin (pinned) {
      store.pinned = !store.pinned
    }
  })
}
