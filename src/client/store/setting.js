/**
 * setting modal
 */

import message from '../components/common/message'
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
import settingList from '../common/setting-list'
import { requireTermOfUse } from '../common/term-of-use'

const e = window.translate

export default Store => {
  Store.prototype.setConfig = function (conf) {
    const { store } = window
    Object.assign(
      store._config,
      copy(conf)
    )
  }
  Store.prototype.setSftpSortSetting = function (conf) {
    Object.assign(
      window.store.sftpSortSetting,
      conf
    )
  }

  Store.prototype.openBookmarkEdit = function (item) {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.bookmarks
    })
    store.setSettingItem(item)
    store.openSettingModal()
    store.settingMobileView = 'content'
  }

  Store.prototype.handleOpenQuickCommandsSetting = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.quickCommands
    })
    store.setSettingItem(getInitItem([], settingMap.quickCommands))
    store.openSettingModal()
  }

  Store.prototype.onSelectHistory = function (tab) {
    const { store } = window
    store.addTab({
      ...copy(tab),
      ...newTerm(true, true),
      batch: window.openTabBatch ?? store.currentLayoutBatch
    })
    delete window.openTabBatch
  }

  Store.prototype.onSelectBookmark = function (id) {
    const { store } = window
    const bookmarks = store.bookmarks
    const item = copy(
      bookmarks.find(it => it.id === id)
    )
    if (!item) {
      return
    }
    store.addTab({
      ...item,
      from: 'bookmarks',
      srcId: item.id,
      ...newTerm(true, true),
      batch: window.openTabBatch ?? store.currentLayoutBatch
    })

    delete window.openTabBatch
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
    store.settingTab = settingMap.setting
    store.setSettingItem(getInitItem([], settingMap.setting))
    store.openSettingModal()
  }

  Store.prototype.openSettingSync = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.setting &&
      store.settingItem.id === settingList()[0].id &&
      store.showModal === modals.setting
    ) {
      return store.hideSettingModal()
    }
    requireTermOfUse('sync', () => {
      store.storeAssign({
        settingTab: settingMap.setting
      })
      store.setSettingItem(settingList().find(d => d.id === settingSyncId))
      store.openSettingModal()
    })
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
      settingTab: settingMap.terminalThemes
    })
    store.setSettingItem(buildNewTheme())
    store.openSettingModal()
  }

  Store.prototype.openSettingModal = function () {
    const { store } = window
    if (store.isSecondInstance) {
      return message.warning(
        e('sencondInstanceTip')
      )
    }
    store.showModal = modals.setting
    // mobile always lands on the left col menu first
    store.settingMobileView = 'menu'
  }

  Store.prototype.backToSettingMenu = function () {
    window.store.settingMobileView = 'menu'
  }

  Store.prototype.hideSettingModal = function () {
    const { store } = window
    store.showModal = modals.hide
    store.setSettingItem({})
    // reset so a later open starts from the menu on mobile
    store.settingMobileView = 'menu'
  }

  Store.prototype.loadFontList = async function () {
    const fonts = await window.pre.runGlobalAsync('loadFontList')
      .catch(err => {
        console.log('loadFontList error', err)
        return []
      })
    window.et.fonts = fonts
  }

  Store.prototype.handleChangeSettingTab = function (settingTab) {
    const { store } = window
    const arr = store.getItems(settingTab)
    const item = getInitItem(arr, settingTab)
    store.storeAssign({
      settingTab
    })
    store.setSettingItem(item)
    // a new tab means a new menu to pick from on mobile
    store.settingMobileView = 'menu'
  }
}
