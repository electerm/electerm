/**
 * bookmark
 */

export default store => {
  Object.assign(store, {
    async getSerials () {
      store.loaddingSerials = true
      const res = await window._require('serialport').list()
        .catch(store.onError)
      if (res) {
        store.serials = res
      }
      store.loaddingSerials = false
    }
  })
}
