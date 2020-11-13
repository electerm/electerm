/**
 * app upgrade
 */

import { appUpdateCheck } from '../common/constants'

export default store => {
  store.onCheckUpdate = () => {
    window.postMessage({
      action: appUpdateCheck
    }, '*')
  }
}
