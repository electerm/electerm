/**
 * setting modal
 */

import { find, isEqual, pick, without, findIndex } from 'lodash-es'
import {
  message
} from 'antd'
import generate from '../common/uid'
import copy from 'json-deep-copy'
import {
  settingMap,
  settingCommonId,
  modals
} from '../common/constants'
import { buildNewTheme } from '../common/terminal-theme'
import getInitItem from '../common/init-setting-item'
import newTerm from '../common/new-terminal'

const { prefix } = window
const m = prefix('menu')

export default Store => {
  Store.prototype.setConfig = function (conf) {
    const { store } = window
    store._config = JSON.stringify(
      {
        ...store.config,
        ...conf
      }
    )
  }
  Store.prototype.setSftpSortSetting = function (conf) {
    const { store } = window
    const base = copy(store.sftpSortSetting)
    store._sftpSortSetting = JSON.stringify(
      {
        ...base,
        ...conf
      }
    )
  }
  Store.prototype.onEditHistory = function () {
    const { store } = window
    const all = store.getItems('history')
    store.storeAssign({
      settingTab: settingMap.history,
      autofocustrigger: Date.now()
    })
    store.setSettingItem(all[0] || getInitItem([], settingMap.history))
    store.openSettingModal()
  }

  Store.prototype.openBookmarkEdit = function (item) {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.bookmarks,
      autofocustrigger: Date.now()
    })
    store.setSettingItem(item)
    store.openSettingModal()
  }

  Store.prototype.openQuickCommandsSetting = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.quickCommands,
      autofocustrigger: Date.now()
    })
    store.setSettingItem(getInitItem([], settingMap.quickCommands))
    store.openSettingModal()
  }

  Store.prototype.onSelectHistory = function (id) {
    const { store } = window
    const history = store.getItems('history')
    const item = find(history, it => it.id === id)
    store.addTab({
      ...copy(item),
      from: 'history',
      srcId: item.id,
      ...newTerm(false)
    })
  }

  Store.prototype.onSelectBookmark = function (id) {
    const { store } = window
    const history = store.getItems('history')
    const bookmarks = store.getBookmarks()
    const item = copy(
      find(bookmarks, it => it.id === id) ||
      find(store.sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    store.addTab({
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      ...newTerm(false)
    })
    item.id = generate()
    if (store.config.disableSshHistory) {
      return
    }
    const existItem = find(history, j => {
      const keysj = Object.keys(j)
      const keysi = Object.keys(item)
      return isEqual(
        pick(item, without(keysi, 'id')),
        pick(j, without(keysj, 'id'))
      )
    })
    if (!existItem) {
      store.addItem(item, settingMap.history)
    } else {
      const index = findIndex(history, f => f.id === existItem.id)
      history.splice(index, 1)
      history.unshift(existItem)
      store.setItems('history', history)
    }
  }

  Store.prototype.openSetting = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.setting &&
      store.settingItem.id === settingCommonId &&
      store.showModal === modals.setting
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.setting
    })
    store.setSettingItem(getInitItem([], settingMap.setting))
    store.openSettingModal()
  }

  Store.prototype.openSettingSync = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.setting &&
      store.settingItem.id === store.setting[0].id &&
      store.showModal === modals.setting
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.setting
    })
    store.setSettingItem(copy(store.setting[0]))
    store.openSettingModal()
  }

  Store.prototype.openTerminalThemes = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.terminalThemes &&
      store.settingItem.id === ''
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.terminalThemes,
      autofocustrigger: Date.now()
    })
    store.setSettingItem(buildNewTheme())
    store.openSettingModal()
  }

  Store.prototype.openSettingModal = function () {
    const { store } = window
    if (store.isSencondInstance) {
      return message.warning(
        m('sencondInstanceTip')
      )
    }
    store.showModal = modals.setting
  }

  Store.prototype.hideSettingModal = function () {
    const { store } = window
    store.showModal = modals.hide
    store.setSettingItem({})
  }

  Store.prototype.loadFontList = async function () {
    const fonts = await window.pre.runGlobalAsync('loadFontList')
      .catch(err => {
        console.log('loadFontList error', err)
        return []
      })
    window.store._fonts = JSON.stringify(fonts)
  }

  Store.prototype.onChangeTab = function (settingTab) {
    const { store } = window
    const arr = store.getItems(settingTab)
    const item = getInitItem(arr, settingTab)
    store.storeAssign({
      autofocustrigger: Date.now(),
      settingTab
    })
    store.setSettingItem(item)
  }
}
