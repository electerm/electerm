/**
 * auto run when data change
 */

import createTitlte from '../common/create-title'
import Subx from 'subx'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { setData, dbNames } from '../common/db'

export default store => {
  // auto focus when tab change
  Subx.autoRun(store, () => {
    store.focus()
    const { currentTabId, tabs } = store
    const tab = _.find(tabs, t => t.id === currentTabId) || {}
    const title = createTitlte(tab)
    window.getGlobal('setTitle')(title)
    return store.currentTabId
  })

  Subx.autoRun(store, () => {
    if (store.menuOpened) {
      store.initMenuEvent()
    } else {
      store.onCloseMenu()
    }
    return store.menuOpened
  })

  Subx.autoRun(store, () => {
    setData('sessions', copy(store.tabs).map(t => {
      delete t.isTransporting
      return t
    }))
    return store.tabs
  })

  for (const _name of dbNames) {
    Subx.autoRun(store, () => {
      const name = _name
      const nm = `${name}Order`
      setData(`${name}:order`, copy(store[nm]))
      const order = store[name].map(g => g.id)
      store[nm] = order
      return order
    })
  }

  Subx.autoRun(store, () => {
    setData('openedCategoryIds', copy(store.openedCategoryIds))
    return store.openedCategoryIds
  })

  Subx.autoRun(store, () => {
    window.getGlobal('saveUserConfig')(store.config)
    return store.config
  })

  Subx.autoRun(store, () => {
    store.checkSettingSync()
    return [
      store.config.theme,
      store.terminalThemes,
      store.bookmarkGroups,
      store.quickCommands,
      store.bookmarks
    ]
  })
}
