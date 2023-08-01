/**
 * setting modal
 */

import _ from 'lodash'
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
      settingItem: all[0] || getInitItem([], settingMap.history),
      autofocustrigger: +new Date()
    })
    store.openSettingModal()
  }

  Store.prototype.openBookmarkEdit = function (item) {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.bookmarks,
      settingItem: item,
      autofocustrigger: +new Date()
    })
    store.openSettingModal()
  }

  Store.prototype.openQuickCommandsSetting = function () {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.quickCommands,
      settingItem: getInitItem([], settingMap.quickCommands),
      autofocustrigger: +new Date()
    })
    store.openSettingModal()
  }

  Store.prototype.onSelectHistory = function (id) {
    const { store } = window
    const history = store.getItems('history')
    const item = _.find(history, it => it.id === id)
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
      _.find(bookmarks, it => it.id === id) ||
      _.find(store.sshConfigItems, it => it.id === id)
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
    const existItem = _.find(history, j => {
      const keysj = Object.keys(j)
      const keysi = Object.keys(item)
      return _.isEqual(
        _.pick(item, _.without(keysi, 'id')),
        _.pick(j, _.without(keysj, 'id'))
      )
    })
    if (!existItem) {
      store.addItem(item, settingMap.history)
    } else {
      const index = _.findIndex(history, f => f.id === existItem.id)
      history.splice(index, 1)
      history.unshift(existItem)
      store.setItems('history', history)
    }
  }

  Store.prototype.openSetting = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.setting &&
      _.get(store.settingItem, 'id') === settingCommonId &&
      store.showModal === modals.setting
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.setting,
      settingItem: getInitItem([], settingMap.setting)
    })
    store.openSettingModal()
  }

  Store.prototype.openSettingSync = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.setting &&
      _.get(store.settingItem, 'id') === store.setting[0].id &&
      store.showModal === modals.setting
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.setting,
      settingItem: copy(store.setting[0])
    })
    store.openSettingModal()
  }

  Store.prototype.openTerminalThemes = function () {
    const { store } = window
    if (
      store.settingTab === settingMap.terminalThemes &&
      _.get(store.settingItem, 'id') === ''
    ) {
      return store.hideSettingModal()
    }
    store.storeAssign({
      settingTab: settingMap.terminalThemes,
      settingItem: buildNewTheme(),
      autofocustrigger: +new Date()
    })
    store.openSettingModal()
  }

  Store.prototype.openSettingModal = function () {
    const { store } = window
    if (store.isSencondInstance) {
      return message.warn(
        m('sencondInstanceTip')
      )
    }
    store.showModal = modals.setting
  }

  Store.prototype.hideSettingModal = function () {
    const { store } = window
    store.showModal = modals.hide
    store.settingItem = {}
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
      settingItem: item,
      autofocustrigger: +new Date(),
      settingTab
    })
  }
}
