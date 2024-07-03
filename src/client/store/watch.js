/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import { autoRun } from 'manate'
import { update, dbNamesForWatch } from '../common/db'
import {
  commonActions,
  sftpDefaultSortSettingKey,
  checkedKeysLsKey,
  expandedKeysLsKey,
  resolutionsLsKey,
  localAddrBookmarkLsKey
} from '../common/constants'
import postMsg from '../common/post-msg'
import * as ls from '../common/safe-local-storage'
import { debounce, isEmpty } from 'lodash-es'

export default store => {
  autoRun(store, () => {
    store.focus()
    // store.termSearchOpen = false
    store.termSearchMatchCount = 0
    return store.currentTabId
  }, func => debounce(func, 100)).start()

  // autoRun(store, () => {
  //   if (store.menuOpened) {
  //     store.initMenuEvent()
  //   } else {
  //     store.onCloseMenu()
  //   }
  //   return store.menuOpened
  // })

  for (const name of dbNamesForWatch) {
    autoRun(store, async () => {
      await update(
        `${name}:order`,
        store.getItems(name).map(d => d.id)
      )
      await store.updateLastDataUpdateTime()
      if (store.config.autoSync) {
        await store.uploadSettingAll()
      }
      return store['_' + name]
    }, func => debounce(func, 100)).start()
  }

  autoRun(store, async () => {
    ls.setItem(resolutionsLsKey, store._resolutions)
    return store._resolutions
  }).start()

  autoRun(store, () => {
    if (!store.showModal) {
      store.focus()
    } else {
      store.blur()
    }
    return store.showModal
  }).start()

  autoRun(store, () => {
    if (!isEmpty(store.config)) {
      window.pre.runGlobalAsync('saveUserConfig', store.config)
    }
    return store._config
  }, func => debounce(func, 100)).start()

  autoRun(store, () => {
    store.updateLastDataUpdateTime()
    return store.config.theme
  }, func => debounce(func, 100)).start()

  autoRun(store, () => {
    store.updateTabsStatus()
    return store.fileTransfers
  }, func => debounce(func, 100)).start()

  autoRun(store, () => {
    ls.setItemJSON(sftpDefaultSortSettingKey, store.sftpSortSetting)
    return store._sftpSortSetting
  }).start()

  autoRun(store, () => {
    ls.setItemJSON(expandedKeysLsKey, store.expandedKeys)
    return store._expandedKeys
  }).start()

  autoRun(store, () => {
    ls.setItemJSON(localAddrBookmarkLsKey, store.addressBookmarksLocal)
    return store._addressBookmarksLocal
  }).start()

  autoRun(store, () => {
    ls.setItemJSON(checkedKeysLsKey, store.checkedKeys)
    return store._checkedKeys
  }).start()

  autoRun(store, () => {
    window.store.onLayoutChange()
    return store.layout
  }).start()

  autoRun(store, () => {
    const tabs = store.getTabs()
    const { currentTabId } = store
    const tab = tabs.find(t => t.id === currentTabId)
    if (tab) {
      const title = createTitle(tab)
      window.pre.runGlobalAsync('setTitle', title)
    }
    postMsg({
      action: commonActions.changeCurrentTabId,
      currentTabId
    })
    return store.currentTabId
  }).start()
}
