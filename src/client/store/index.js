/**
 * central state store powered by use-proxy - https://github.com/tylerlong/use-proxy
 */

import { useProxy } from '@tylerlong/use-proxy'
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

class Store {
  constructor () {
    Object.assign(
      this,
      initState
    )
  }

  get width () {
    return window.store.innerWidth - sidebarWidth -
      (window.store.pinned ? sidebarPanelWidth : 0)
  }

  get currentQuickCommands () {
    const { currentTab } = this
    const quickCommands = window.store.getQuickCommands()
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
  }

  get currentTab () {
    const {
      currentTabId
    } = this
    const tabs = window.store.getTabs()
    const tab = tabs.find(t => t.id === currentTabId)
    if (!tab) {
      return false
    }
    return tab
  }

  get quickCommandTags () {
    const quickCommands = window.store.getQuickCommands()
    return _.uniq(
      quickCommands.reduce((p, q) => {
        return [
          ...p,
          ...(q.labels || [])
        ]
      }, [])
    )
  }

  get isTransporting () {
    return window.store.getTabs().some(t => t.isTransporting)
  }

  get settingSidebarList () {
    const {
      settingTab
    } = this
    const arr = window.store.getSidebarList(settingTab)
    const initItem = getInitItem(arr, settingTab)
    return settingTab === settingMap.history
      ? arr
      : [
        copy(initItem),
        ...arr
      ]
  }

  get tabTitles () {
    return window.store.getTabs().map(d => d.title).join('#')
  }

  get sshConfigItems () {
    return JSON.parse(window.store._sshConfigItems || '[]')
  }

  get itermThemes () {
    return JSON.parse(window.store._itermThemes || '[]')
  }

  get history () {
    return JSON.parse(window.store._history || '[]')
  }

  get bookmarks () {
    return JSON.parse(window.store._bookmarks || '[]')
  }

  get bookmarkGroups () {
    return JSON.parse(window.store._bookmarkGroups || '[]')
  }

  get tabs () {
    return JSON.parse(window.store._tabs || '[]')
  }

  get fileTransfers () {
    return JSON.parse(window.store._fileTransfers || '[]')
  }

  get transferHistory () {
    return JSON.parse(window.store._transferHistory || '[]')
  }

  get quickCommands () {
    return JSON.parse(window.store._quickCommands || '[]')
  }

  get terminalThemes () {
    return JSON.parse(window.store._terminalThemes || '[]')
  }

  get serials () {
    return JSON.parse(window.store._serials || '[]')
  }

  get setting () {
    return JSON.parse(window.store._setting || '[]')
  }

  get config () {
    return JSON.parse(window.store._config || '{}')
  }

  get sftpSortSetting () {
    return JSON.parse(window.store._sftpSortSetting)
  }

  get fonts () {
    return JSON.parse(window.store._fonts || '[]')
  }

  get onOperation () {
    return window.store.showModal || window.store.termSearchOpen || window.store.showInfoModal || window.store.showEditor || window.store.showFileModal
  }

  get topMenuHeight () {
    return window.store.config.useSystemTitleBar ? 0 : 15
  }

  get tabsHeight () {
    return window.store.config.useSystemTitleBar ? 45 : 56
  }

  get langs () {
    return JSON.parse(window.store._langs)
  }

  get upgradeInfo () {
    return JSON.parse(window.store._upgradeInfo)
  }
}

loadDataExtend(Store)
eventExtend(Store)
dbUpgradeExtend(Store)
syncExtend(Store)
appUpgrdeExtend(Store)
bookmarkGroupExtend(Store)
bookmarkExtend(Store)
commonExtend(Store)
contextMenuExtend(Store)
itemExtend(Store)
quickCommandExtend(Store)
sessionExtend(Store)
settingExtend(Store)
sidebarExtend(Store)
sysMenuExtend(Store)
tabExtend(Store)
terminalThemeExtend(Store)
uiThemeExtend(Store)
transferHistoryExtend(Store)
batchInputHistory(Store)
transferExtend(Store)

const store = useProxy(new Store())

window.store = store
export default store
