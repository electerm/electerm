/**
 * central state store powered by subx - https://github.com/tylerlong/subx
 */

import Subx from 'subx'
import initState from './init-state'
import loadDataExtend from './load-data'
import dbUpgradeExtend from './db-upgrade'
import eventExtend from './event'
import syncExtend from './sync'
import appUpgrdeExtend from './app-upgrade'
import bookmarkGroupExtend from './bookmark-group'
import bookmarkExtend from './bookmark'
import commonExtend from './common'
import contextMenuExtend from './context-menu'
import itemExtend from './item'
import quickCommandExtend from './quick-command'
import sessionExtend from './session'
import settingExtend from './setting'
import sidebarExtend from './sidebar'
import sysMenuExtend from './system-menu'
import tabExtend from './tab'
import uiThemeExtend from './ui-theme'
import terminalThemeExtend from './terminal-theme'
import transferHistoryExtend from './transfer-history'
import batchInputHistory from './batch-input-history'
import transferExtend from './transfer-list'

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  settingMap,
  sidebarWidth,
  sidebarPanelWidth
} from '../common/constants'
import getInitItem from '../common/init-setting-item'

const store = Subx.create({
  ...initState,
  get width () {
    return store.innerWidth - sidebarWidth -
      (store.pinned ? sidebarPanelWidth : 0)
  },
  get currentQuickCommands () {
    const { currentTab } = store
    const quickCommands = store.getQuickCommands()
    const currentTabQuickCommands = (
      _.get(
        currentTab, 'quickCommands'
      ) || []
    ).map((d, i) => {
      return {
        ...d,
        id: 'tab-qm-' + currentTab.id + '#' + i
      }
    })
    return [
      ...currentTabQuickCommands,
      ...quickCommands
    ]
  },
  get currentTab () {
    const {
      currentTabId
    } = store
    const tabs = store.getTabs()
    const tab = tabs.find(t => t.id === currentTabId)
    if (!tab) {
      return false
    }
    return tab
  },
  get quickCommandTags () {
    const quickCommands = store.getQuickCommands()
    return _.uniq(
      quickCommands.reduce((p, q) => {
        return [
          ...p,
          ...(q.labels || [])
        ]
      }, [])
    )
  },
  get isTransporting () {
    return store.getTabs().some(t => t.isTransporting)
  },
  get settingSidebarList () {
    const {
      settingTab
    } = store
    const arr = store.getSidebarList(settingTab)
    const initItem = getInitItem(arr, settingTab)
    return settingTab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  },
  get tabTitles () {
    return store.getTabs().map(d => d.title).join('#')
  },
  get config () {
    return JSON.parse(store._config)
  },
  get sftpSortSetting () {
    return JSON.parse(store._sftpSortSetting)
  },
  get fonts () {
    return store._fonts.map(f => JSON.parse(f))
  },
  get onOperation () {
    return store.showModal || store.termSearchOpen || store.showInfoModal || store.showEditor || store.showFileModal
  }
})

loadDataExtend(store)
eventExtend(store)
dbUpgradeExtend(store)
syncExtend(store)
appUpgrdeExtend(store)
bookmarkGroupExtend(store)
bookmarkExtend(store)
commonExtend(store)
contextMenuExtend(store)
itemExtend(store)
quickCommandExtend(store)
sessionExtend(store)
settingExtend(store)
sidebarExtend(store)
sysMenuExtend(store)
tabExtend(store)
terminalThemeExtend(store)
uiThemeExtend(store)
transferHistoryExtend(store)
batchInputHistory(store)
transferExtend(store)

window.store = store
export default store
