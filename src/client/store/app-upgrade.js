/**
 * app upgrade
 */

import { commonActions } from '../common/constants'

export default Store => {
  Store.prototype.onCheckUpdate = () => {
    window.postMessage({
      action: commonActions.appUpdateCheck
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
