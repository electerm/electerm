/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import { autoRun } from 'manate'
import { update, remove, dbNamesForWatch } from '../common/db'
import {
  sftpDefaultSortSettingKey,
  checkedKeysLsKey,
  expandedKeysLsKey,
  resolutionsLsKey,
  localAddrBookmarkLsKey,
  aiChatHistoryKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import { debounce, isEmpty } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import refs from '../components/common/ref'
import dataCompare from '../common/data-compare'

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
      const old = refs.get('oldState-' + name)
      const n = store.getItems(name)
      const { updated, added, removed } = dataCompare(
        old,
        n
      )
      for (const item of removed) {
        await remove(name, item.id)
      }
      for (const item of updated) {
        await update(item.id, item, name, false)
      }
      store.batchDbAdd(added.map(d => {
        return {
          db: name,
          obj: d
        }
      }))
      await update(
        `${name}:order`,
        (n || []).map(d => d.id)
      )
      refs.add('oldState-' + name, deepCopy(n) || [])
      await store.updateLastDataUpdateTime()
      if (store.config.autoSync) {
        await store.uploadSettingAll()
      }
      return store[name]
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
    return store.addressBookmarksLocal
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
    ls.setItemJSON(aiChatHistoryKey, store.aiChatHistory)
    return store.aiChatHistory
  }).start()

  autoRun(() => {
    store.updateBatchInputSelectedTabIds()
    const tabs = store.getTabs()
    const { activeTabId } = store
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab) {
      const title = createTitle(tab)
      window.pre.runGlobalAsync('setTitle', title)
      window.store.currentLayoutBatch = tab.batch
    }
    if (tab && store.rightPanelVisible) {
      window.store.openInfoPanelAction()
    }
    return store.activeTabId
  }).start()
}
