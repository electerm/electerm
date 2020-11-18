/**
 * setting modal
 */

import _ from 'lodash'
import { nanoid as generate } from 'nanoid/non-secure'
import copy from 'json-deep-copy'
import {
  settingMap,
  statusMap,
  sshConfigItems
} from '../common/constants'
import { buildNewTheme } from '../common/terminal-theme'
import getInitItem from '../common/init-setting-item'

const defaultStatus = statusMap.processing

export default store => {
  Object.assign(store, {
    onEditHistory () {
      store.storeAssign({
        tab: settingMap.history,
        settingItem: store.history[0] || getInitItem([], settingMap.history),
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
      const item = _.find(store.history, it => it.id === id)
      store.addTab({
        ...copy(item),
        from: 'history',
        srcId: item.id,
        status: defaultStatus,
        id: generate()
      })
    },

    onSelectBookmark (id) {
      const { history, bookmarks } = store
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
      }
    },

    openSetting () {
      store.storeAssign({
        tab: settingMap.setting,
        settingItem: getInitItem([], settingMap.setting)
      })
      store.openModal()
    },

    openSettingSync () {
      store.storeAssign({
        tab: settingMap.setting,
        settingItem: copy(store.setting[0])
      })
      store.openModal()
    },

    openTerminalThemes () {
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
      store.focus()
    },

    getItems (tab, props = store) {
      return copy(props[tab]) || []
    },

    async loadFontList () {
      const fonts = await window.pre.runGlobalAsync('loadFontList')
      store.fonts = fonts
    }
  })
}
