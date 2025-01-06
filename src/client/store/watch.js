/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import { autoRun } from 'manate'
import { update, dbNamesForWatch } from '../common/db'
import {
  sftpDefaultSortSettingKey,
  checkedKeysLsKey,
  expandedKeysLsKey,
  resolutionsLsKey,
  localAddrBookmarkLsKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import { debounce, isEmpty } from 'lodash-es'

export default store => {
  // autoRun(() => {
  //   store.focus()
  //   // store.termSearchOpen = false
  //   store.termSearchMatchCount = 0
  //   return store.activeTabId
  // }).start()

  // autoRun(() => {
  //   if (store.menuOpened) {
  //     store.initMenuEvent()
  //   } else {
  //     store.onCloseMenu()
  //   }
  //   return store.menuOpened
  // })

  for (const name of dbNamesForWatch) {
    autoRun(async () => {
      await update(
        `${name}:order`,
        store.getItems(name).map(d => d.id)
      )
      await store.updateLastDataUpdateTime()
      if (store.config.autoSync) {
        await store.uploadSettingAll()
      }
      return store['_' + name]
    }).start()
  }

  autoRun(async () => {
    ls.setItemJSON(resolutionsLsKey, store.resolutions)
    return store.resolutions
  }).start()

  autoRun(() => {
    if (!store.showModal) {
      store.focus()
    } else {
      store.blur()
    }
    return store.showModal
  }).start()

  autoRun(() => {
    if (!isEmpty(store.config)) {
      window.pre.runGlobalAsync('saveUserConfig', store.config)
    }
    return store.config
  }, func => debounce(func, 100)).start()

  autoRun(() => {
    store.updateLastDataUpdateTime()
    return store.config.theme
  }, func => debounce(func, 100)).start()

  autoRun(() => {
    store.updateTabsStatus()
    return store.transferCount
  }).start()

  autoRun(() => {
    ls.setItemJSON(sftpDefaultSortSettingKey, store.sftpSortSetting)
    return store.sftpSortSetting
  }).start()

  autoRun(() => {
    ls.setItemJSON(expandedKeysLsKey, store.expandedKeys)
    return store.expandedKeys
  }).start()

  autoRun(() => {
    ls.setItemJSON(localAddrBookmarkLsKey, store.addressBookmarksLocal)
    return store._addressBookmarksLocal
  }).start()

  autoRun(() => {
    ls.setItemJSON(checkedKeysLsKey, store.checkedKeys)
    return store.checkedKeys
  }).start()

  autoRun(() => {
    ls.setItemJSON('history', store.history)
    return store.history
  }).start()

  autoRun(() => {
    store.updateBatchInputSelectedTabIds()
    return store.activeTabId
  }).start()

  autoRun(() => {
    const tabs = store.getTabs()
    const { activeTabId } = store
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab) {
      const title = createTitle(tab)
      window.pre.runGlobalAsync('setTitle', title)
      window.store.currentLayoutBatch = tab.batch
    }
    if (tab && store.rightPanelVisible) {
      window.store.openInfoPanel()
    }
    return store.activeTabId
  }).start()
}
