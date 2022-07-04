/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import Subx from 'subx'
import copy from 'json-deep-copy'
import { update, dbNames } from '../common/db'
import { debounceTime } from 'rxjs/operators'
import {
  commonActions,
  sftpDefaultSortSettingKey
} from '../common/constants'
import postMsg from '../common/post-msg'
import * as ls from '../common/safe-local-storage'

export default store => {
  Subx.autoRun(store, () => {
    store.focus()
    return store.currentTabId
  }, debounceTime(1000))

  // Subx.autoRun(store, () => {
  //   if (store.menuOpened) {
  //     store.initMenuEvent()
  //   } else {
  //     store.onCloseMenu()
  //   }
  //   return store.menuOpened
  // })

  Subx.autoRun(store, () => {
    const v = store.getItems('tabs').map(t => {
      delete t.isTransporting
      return t
    })
    update('sessions', v)
    return store.tabs
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    if (!store.tabs.length) {
      setTimeout(store.addTab, 1)
    }
    return store.tabs
  })

  for (const name of dbNames) {
    Subx.autoRun(store, async () => {
      await update(
        `${name}:order`,
        store.getItems(name).map(d => d.id)
      )
      await store.updateLastDataUpdateTime()
      return store[name]
    }, debounceTime(500))
  }

  Subx.autoRun(store, () => {
    update('openedCategoryIds', copy(store.openedCategoryIds))
    return store.openedCategoryIds
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    window.pre.runGlobalAsync('saveUserConfig', copy(store.config))
    return store._config
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    store.updateLastDataUpdateTime()
    return store.config.theme
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    store.updateTabsStatus()
    return store.fileTransfers
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    ls.setItemJSON(sftpDefaultSortSettingKey, store.sftpSortSetting)
    return store._sftpSortSetting
  })

  Subx.autoRun(store, () => {
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
  })
}
