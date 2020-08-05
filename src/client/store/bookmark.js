/**
 * bookmark
 */

import fetch from '../common/fetch'

const { host, port } = window._config

export default store => {
  Object.assign(store, {
    async getSerials () {
      store.loaddingSerials = true
      const res = await fetch.get(`http://${host}:${port}/serial-port`)
        .catch(store.onError)
      if (res) {
        store.serials = res
      }
      store.loaddingSerials = false
    }
  })
}
