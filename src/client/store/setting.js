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
  settingCommonId
} from '../common/constants'
import { buildNewTheme } from '../common/terminal-theme'
import getInitItem from '../common/init-setting-item'
import newTerm from '../common/new-terminal'

const { prefix } = window
const m = prefix('menu')

export default store => {
  Object.assign(store, {
    setConfig (conf) {
      const base = copy(store.config)
      store._config = JSON.stringify(
        {
          ...base,
          ...conf
        }
      )
    },
    setSftpSortSetting (conf) {
      const base = copy(store.sftpSortSetting)
      store._sftpSortSetting = JSON.stringify(
        {
          ...base,
          ...conf
        }
      )
    },
    onEditHistory () {
      const all = store.getItems('history')
      store.storeAssign({
        settingTab: settingMap.history,
        settingItem: all[0] || getInitItem([], settingMap.history),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openBookmarkEdit (item) {
      store.storeAssign({
        settingTab: settingMap.bookmarks,
        settingItem: item,
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openQuickCommandsSetting () {
      store.storeAssign({
        settingTab: settingMap.quickCommands,
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
        ...newTerm(false)
      })
    },

    onSelectBookmark (id) {
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
    },

    openSetting () {
      if (
        store.settingTab === settingMap.setting &&
        _.get(store.settingItem, 'id') === settingCommonId
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        settingTab: settingMap.setting,
        settingItem: getInitItem([], settingMap.setting)
      })
      store.openModal()
    },

    openSettingSync () {
      if (
        store.settingTab === settingMap.setting &&
        _.get(store.settingItem, 'id') === store.setting[0].id
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        settingTab: settingMap.setting,
        settingItem: copy(store.setting[0])
      })
      store.openModal()
    },

    openTerminalThemes () {
      if (
        store.settingTab === settingMap.terminalThemes &&
        _.get(store.settingItem, 'id') === ''
      ) {
        return store.hideModal()
      }
      store.storeAssign({
        settingTab: settingMap.terminalThemes,
        settingItem: buildNewTheme(),
        autofocustrigger: +new Date()
      })
      store.openModal()
    },

    openModal () {
      if (store.isSencondInstance) {
        return message.warn(
          m('sencondInstanceTip')
        )
      }
      store.showModal = true
    },

    hideModal () {
      store.showModal = false
      store.settingItem = {}
      store.focus()
    },

    async loadFontList () {
      const fonts = await window.pre.runGlobalAsync('loadFontList')
      store._fonts = fonts.map(f => JSON.stringify(f))
    },

    onChangeTab (settingTab) {
      const arr = store.getItems(settingTab)
      const item = getInitItem(arr, settingTab)
      store.storeAssign({
        settingItem: item,
        autofocustrigger: +new Date(),
        settingTab
      })
    }
  })
}
