/**
 * app upgrade
 */

import { commonActions } from '../common/constants'
import copy from 'json-deep-copy'

export default Store => {
  Store.prototype.onCheckUpdate = () => {
    window.postMessage({
      action: commonActions.appUpdateCheck
    }, '*')
  }
  Store.prototype.getProxySetting = function () {
    const cpConf = copy(window.store.config)
    return Object
      .keys((cpConf))
      .filter(d => d.toLowerCase().includes('proxy'))
      .reduce((p, k) => {
        return {
          ...p,
          [k]: cpConf[k]
        }
      }, {})
  }
}
