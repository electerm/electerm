/**
 * auto run when data change
 */

import createTitlte from '../common/create-title'
import Subx from 'subx'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { update, dbNames } from '../common/db'
import { debounceTime } from 'rxjs/operators'

export default store => {
  // auto focus when tab change
  Subx.autoRun(store, () => {
    store.focus()
    const { currentTabId, tabs } = store
    const tab = _.find(tabs, t => t.id === currentTabId) || {}
    const title = createTitlte(tab)
    window.pre.runGlobalAsync('setTitle', title)
    return store.currentTabId
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    if (store.menuOpened) {
      store.initMenuEvent()
    } else {
      store.onCloseMenu()
    }
    return store.menuOpened
  })

  Subx.autoRun(store, () => {
    const v = copy(store.tabs).map(t => {
      delete t.isTransporting
      return t
    })
    update('sessions', v)
    return store.tabs
  }, debounceTime(1000))

  for (const name of dbNames) {
    Subx.autoRun(store, async () => {
      await update(`${name}:order`, copy(store[name].map(d => d.id)))
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
    return store.config
  }, debounceTime(1000))

  Subx.autoRun(store, () => {
    store.updateLastDataUpdateTime()
    return store.config.theme
  }, debounceTime(1000))
}
