/**
 * app upgrade
 */

import { appUpdateCheck } from '../common/constants'
import copy from 'json-deep-copy'

export default store => {
  store.onCheckUpdate = () => {
    window.postMessage({
      action: appUpdateCheck
    }, '*')
  }
  store.getProxySetting = () => {
    const cpConf = copy(store.config)
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
