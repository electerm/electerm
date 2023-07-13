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
    const p = window.store.config.proxy
    return typeof p !== 'string' ? '' : p
  }
}
