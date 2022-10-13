/**
 * auto run when data change
 */

import createTitle from '../common/create-title'
import autoRun from './auto-run'
import copy from 'json-deep-copy'
import { update, dbNames } from '../common/db'
import {
  commonActions,
  sftpDefaultSortSettingKey
} from '../common/constants'
import postMsg from '../common/post-msg'
import * as ls from '../common/safe-local-storage'
import _ from 'lodash'

export default store => {
  autoRun(store, () => {
    store.focus()
    return store.currentTabId
  }, func => _.debounce(func, 100))

  // autoRun(store, () => {
  //   if (store.menuOpened) {
  //     store.initMenuEvent()
  //   } else {
  //     store.onCloseMenu()
  //   }
  //   return store.menuOpened
  // })

  // autoRun(store, () => {
  //   const v = store.getItems('tabs').map(t => {
  //     delete t.isTransporting
  //     return t
  //   })
  //   update('sessions', v)
  //   return store._tabs
  // }, func => _.debounce(func, 100))

  for (const name of dbNames) {
    autoRun(store, async () => {
      await update(
        `${name}:order`,
        store.getItems(name).map(d => d.id)
      )
      await store.updateLastDataUpdateTime()
      return store['_' + name]
    }, func => _.debounce(func, 100))
  }

  autoRun(store, () => {
    update('openedCategoryIds', copy(store.openedCategoryIds))
    return store.openedCategoryIds
  }, func => _.debounce(func, 100))

  autoRun(store, () => {
    if (!store.showModal) {
      store.focus()
    } else {
      store.blur()
    }
    return store.showModal
  })

  autoRun(store, () => {
    window.pre.runGlobalAsync('saveUserConfig', store.config)
    return store._config
  }, func => _.debounce(func, 100))

  autoRun(store, () => {
    store.updateLastDataUpdateTime()
    return store.config.theme
  }, func => _.debounce(func, 100))

  autoRun(store, () => {
    store.updateTabsStatus()
    return store.fileTransfers
  }, func => _.debounce(func, 100))

  autoRun(store, () => {
    ls.setItemJSON(sftpDefaultSortSettingKey, store.sftpSortSetting)
    return store._sftpSortSetting
  })

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
  })
}
