/**
 * db upgrade
 */

import { Modal } from 'antd'
import delay from '../common/wait'

export default (Store) => {
  Store.prototype.checkForDbUpgrade = async function () {
    const { store } = window
    if (store.isSecondInstance) {
      return false
    }
    const shouldUpgrade = await window.pre.runGlobalAsync('checkDbUpgrade')
    const shouldMigrate = await window.pre.runGlobalAsync('checkMigrate')
    if (!shouldUpgrade && !shouldMigrate) {
      return false
    }
    let mod
    if (shouldMigrate) {
      mod = Modal.info({
        title: 'Migrating database',
        content: 'Migrating database... please wait',
        keyboard: false,
        okButtonProps: {
          style: {
            display: 'none'
          }
        }
      })
      await window.pre.runGlobalAsync('migrate')
      mod.update({
        title: 'Done',
        content: 'Database Migrated',
        okButtonProps: {}
      })
      await delay(2000)
      mod.destroy()
    }
    if (shouldUpgrade) {
      const {
        dbVersion,
        packVersion
      } = shouldUpgrade
      mod = Modal.info({
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
    }
    await store.restart()
    return true
  }
}
