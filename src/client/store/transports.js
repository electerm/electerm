/**
 * current transport list
 */

export default store => {
  Object.assign(store, {
    addTransport (transport, index = store.transports.length) {
      store.tabs.splice(index, 0, transport)
    },

    editTransport (id, update) {
      store.editItem(id, update, 'transports')
      window.postMessage({
        type: 'editTransport',
        id,
        update
      }, '*')
    },

    delTransport ({ id }) {
      store.transports = store.transports.filter(t => {
        return t.id !== id
      })
      window.postMessage({
        type: 'delTransport',
        id
      }, '*')
    }
  })
}
