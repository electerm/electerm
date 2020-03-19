/**
 * context menu related functions
 */

export default store => {
  Object.assign(store, {
    initContextEvent () {
      const dom = document.getElementById('outside-context')
      dom && dom.addEventListener('click', store.closeContextMenu)
    },

    openContextMenu (contextMenuProps) {
      store.storeAssign({
        contextMenuProps,
        contextMenuVisible: true
      })
      store.initContextEvent()
    },

    closeContextMenu () {
      store.storeAssign({
        contextMenuVisible: false
      })
      store.dom && store.dom.removeEventListener('click', store.closeContextMenu)
    }
  })
}
