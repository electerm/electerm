/**
 * db upgrade
 */

import { Modal } from 'antd'
import delay from '../common/wait'

export default (store) => {
  store.checkForDbUpgrade = async () => {
    const shouldUpgrade = await window.pre.runGlobalAsync('checkDbUpgrade')
    if (!shouldUpgrade) {
      return false
    }
    const {
      dbVersion,
      packVersion
    } = shouldUpgrade
    const mod = Modal.info({
      title: 'Upgrading database',
      content: `Upgrading database... from v${dbVersion} to v${packVersion} please wait`,
      keyboard: false,
      okButtonProps: {
        style: {
          display: 'none'
        }
      }
    })
    await window.pre.runGlobalAsync('doUpgrade')
    mod.update({
      title: 'Done',
      content: 'Database Upgraded',
      okButtonProps: {}
    })
    await delay(1000)
    mod.destroy()
    return true
  }
}
