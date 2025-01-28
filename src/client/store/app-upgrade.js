/**
 * app upgrade
 */

import { refsStatic } from '../components/common/ref'

export default Store => {
  Store.prototype.onCheckUpdate = (noSkip = true) => {
    refsStatic.get('upgrade')?.appUpdateCheck(noSkip)
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
