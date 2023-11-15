/**
 * db upgrade
 */

import { Modal } from 'antd'
import delay from '../common/wait'
import initWatch from './watch'

export default (Store) => {
  Store.prototype.checkForDbUpgrade = async function () {
    const { store } = window
    if (store.isSencondInstance) {
      return false
    }
    const shouldUpgrade = await window.pre.runGlobalAsync('checkDbUpgrade')
    if (!shouldUpgrade) {
      initWatch(store)
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
    await delay(2000)
    mod.destroy()
    await store.restart()
    return true
  }
}
