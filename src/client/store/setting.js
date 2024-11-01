/**
 * setting modal
 */

import { find } from 'lodash-es'
import {
  message
} from 'antd'
import generate from '../common/uid'
import copy from 'json-deep-copy'
import {
  settingMap,
  settingCommonId,
  settingSyncId,
  modals
} from '../common/constants'
import { buildNewTheme } from '../common/terminal-theme'
import getInitItem from '../common/init-setting-item'
import newTerm from '../common/new-terminal'

const e = window.translate

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
  Store.prototype.handleEditHistory = function () {
    const { store } = window
    const all = store.history
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

  Store.prototype.handleOpenQuickCommandsSetting = function () {
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
    const history = store.history
    const item = find(history, it => it.id === id)
    store.addTab({
      ...copy(item),
      from: 'history',
      srcId: item.id,
      ...newTerm(true, true)
    })
  }

  Store.prototype.onSelectBookmark = function (id) {
    const { store } = window
    const history = store.history
    const bookmarks = store.bookmarks
    const item = copy(
      find(bookmarks, it => it.id === id) ||
      find(store.sshConfigItems, it => it.id === id)
    )
    if (!item) {
      return
    }
    console.log('window.openTabBatch ?? store.currentLayoutBatch', window.openTabBatch, store.currentLayoutBatch)
    store.addTab({
      batch: window.openTabBatch ?? store.currentLayoutBatch,
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      ...newTerm(true, true)
    })

    delete window.openTabBatch

    if (store.config.disableSshHistory) {
      return
    }

    // Critical Change: Use bookmarkId for matching instead of history id
    const bookmarkId = item.id
    const existingIndex = history.findIndex(h => h.bookmarkId === bookmarkId)
    if (existingIndex >= 0) {
      history[existingIndex].count = (history[existingIndex].count || 0) + 1
      history[existingIndex].lastUse = Date.now()
      const updatedItem = history.splice(existingIndex, 1)[0]
      history.unshift(updatedItem)
    } else {
      const historyItem = {
        ...item,
        id: generate(), // History item gets a unique id
        bookmarkId, // Store original bookmark id for future matching
        count: 1,
        lastUse: Date.now()
      }
      history.unshift(historyItem)
    }

    history.sort((a, b) => b.count - a.count || b.lastUse - a.lastUse)

    // Optional: Consider max history length
    const maxHistoryLength = store.config.maxHistoryLength || 50
    if (history.length > maxHistoryLength) {
      history.length = maxHistoryLength
    }

    store.setItems('history', history)
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
    store.setSettingItem(copy(store.setting.find(d => d.id === settingSyncId)))
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
        e('sencondInstanceTip')
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

  Store.prototype.handleChangeSettingTab = function (settingTab) {
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
