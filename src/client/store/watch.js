/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import { autoRun } from 'manate'
import { update, remove, insert, dbNamesForWatch, dbNamesForSync } from '../common/db'
import {
  sftpDefaultSortSettingKey,
  checkedKeysLsKey,
  expandedKeysLsKey,
  resolutionsLsKey,
  localAddrBookmarkLsKey,
  syncServerDataKey
} from '../common/constants'
import * as ls from '../common/safe-local-storage'
import { debounce, isEmpty } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import { refsStatic } from '../components/common/ref'
import dataCompare from '../common/data-compare'

export default store => {
  for (const name of dbNamesForWatch) {
    window[`watch${name}`] = autoRun(async () => {
      const n = store.getItems(name)
      if (window.migrating) {
        return
      }
      const old = refsStatic.get('oldState-' + name)
      const { updated, added, removed } = dataCompare(
        old,
        n
      )
      // Update snapshot immediately before async DB writes to prevent
      // race conditions: a second autoRun firing before the first
      // completes would see stale oldState and re-insert the same items,
      // causing NeDB unique constraint errors.
      refsStatic.add('oldState-' + name, deepCopy(n) || [])
      await Promise.all([
        ...removed.map(item => remove(name, item.id)),
        ...updated.map(item => update(item.id, item, name, false)),
        added.length ? insert(name, added) : Promise.resolve()
      ])
      const newOrder = (n || []).map(d => d.id)
      await update(
        `${name}:order`,
        newOrder
      )
      if (name === 'bookmarks') {
        store.bookmarksMap = new Map(
          n.map(d => [d.id, d])
        )
      }
      await store.updateLastDataUpdateTime()
      if (dbNamesForSync.includes(name)) {
        const syncSetting = store.config.syncSetting || {}
        const { autoSync, autoSyncInterval, autoSyncDirection } = syncSetting
        if (autoSync && autoSyncInterval === 0) {
          if (autoSyncDirection === 'download') {
            await store.downloadSettingAll()
          } else {
            await store.uploadSettingAll()
          }
        }
      }
      return store[name]
    })
    window[`watch${name}`].start()
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
    ls.setItemJSON(syncServerDataKey, store.syncServerStatus)
    return store.syncServerStatus
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
