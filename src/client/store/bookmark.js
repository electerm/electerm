/**
 * bookmark
 */

export default store => {
  Object.assign(store, {
    async getSerials () {
      store.loaddingSerials = true
      const res = await window.pre.runGlobalAsync('listSerialPorts')
        .catch(store.onError)
      if (res) {
        store.serials = res
      }
      store.loaddingSerials = false
    }
  })
}
