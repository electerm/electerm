/**
 * app upgrade
 */

import { commonActions } from '../common/constants'

export default Store => {
  Store.prototype.onCheckUpdate = (noSkip = true) => {
    window.postMessage({
      action: commonActions.appUpdateCheck,
      noSkip
    }, '*')
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
