/**
 * app upgrade
 */

import refs from '../components/common/ref'

export default Store => {
  Store.prototype.onCheckUpdate = (noSkip = true) => {
    refs.get('upgrade')?.appUpdateCheck(noSkip)
  }
  Store.prototype.getProxySetting = function () {
    const {
      proxy,
      enableGlobalProxy
    } = window.store.config
    if (!enableGlobalProxy) {
      return ''
    }
    return typeof proxy !== 'string' ? '' : proxy
  }
}
