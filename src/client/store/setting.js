/**
 * setting modal
 */

import _ from 'lodash'
import generate from '../common/uid'
import copy from 'json-deep-copy'
import {
  settingMap,
  statusMap,
  sshConfigItems,
  settingCommonId
} from '../common/constants'
import { buildNewTheme } from '../common/terminal-theme'
import getInitItem from '../common/init-setting-item'

const defaultStatus = statusMap.processing

export default store => {
  Object.assign(store, {
    onEditHistory () {
      const all = store.getItems('history')
      store.storeAssign({
        tab: settingMap.history,
        settingItem: all[0] || getInitItem([], settingMap.history),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openBookmarkEdit (item) {
      store.storeAssign({
        tab: settingMap.bookmarks,
        settingItem: item,
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openQuickCommandsSetting () {
      store.storeAssign({
        tab: settingMap.quickCommands,
        settingItem: getInitItem([], settingMap.quickCommands),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    onSelectHistory (id) {
      const history = store.getItems('history')
      const item = _.find(history, it => it.id === id)
      store.addTab({
        ...copy(item),
        from: 'history',
        srcId: item.id,
        status: defaultStatus,
        id: generate()
      })
    },

    onSelectBookmark (id) {
      const history = store.getItems('history')
      const bookmarks = store.getItems('bookmarks')
      const item = copy(
        _.find(bookmarks, it => it.id === id) ||
        _.find(sshConfigItems, it => it.id === id)
      )
      if (!item) {
        return
      }
      store.addTab({
        ...item,
        from: 'bookmarks',
        srcId: item.id,
        status: defaultStatus,
        id: generate()
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
    },

    openSetting () {
      if (
        store.tab === settingMap.setting &&
        _.get(store.settingItem, 'id') === settingCommonId
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        tab: settingMap.setting,
        settingItem: getInitItem([], settingMap.setting)
      })
      store.openModal()
    },

    openSettingSync () {
      if (
        store.tab === settingMap.setting &&
        _.get(store.settingItem, 'id') === store.setting[0].id
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        tab: settingMap.setting,
        settingItem: copy(store.setting[0])
      })
      store.openModal()
    },

    openTerminalThemes () {
      if (
        store.tab === settingMap.terminalThemes &&
        _.get(store.settingItem, 'id') === ''
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        tab: settingMap.terminalThemes,
        settingItem: buildNewTheme(),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openModal () {
      store.showModal = true
    },

    hideModal () {
      store.showModal = false
      store.settingItem = {}
      store.focus()
    },

    async loadFontList () {
      const fonts = await window.pre.runGlobalAsync('loadFontList')
      store.fonts = fonts
    },

    onChangeTab (tab) {
      const arr = store.getItems(tab)
      const item = getInitItem(arr, tab)
      store.storeAssign({
        settingItem: item,
        autofocustrigger: +new Date(),
        tab
      })
    }
  })
}
