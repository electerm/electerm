/**
 * central state store powered by manate - https://github.com/tylerlong/manate
 */

import initState from './init-state'
import loadDataExtend from './load-data'
import dbUpgradeExtend from './db-upgrade'
import eventExtend from './event'
import syncExtend from './sync'
import appUpgradeExtend from './app-upgrade'
import bookmarkGroupExtend from './bookmark-group'
import bookmarkExtend from './bookmark'
import commonExtend from './common'
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
import addressBookmarkExtend from './address-bookmark'
import isColorDark from '../common/is-color-dark'
import { getReverseColor } from '../common/reverse-color'
import { uniq } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import getBrand from '../components/ai/get-brand'
import {
  settingMap,
  paneMap,
  settingSyncId,
  settingShortcutsId,
  settingTerminalId,
  terminalSshConfigType
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import createTitle from '../common/create-title'
import {
  theme
} from 'antd'

const e = window.translate

class Store {
  constructor () {
    Object.assign(
      this,
      initState()
    )
  }

  get width () {
    return window.store.innerWidth
  }

  get config () {
    return deepCopy(window.store._config)
  }

  get currentQuickCommands () {
    const { currentTab } = this
    const { quickCommands } = window.store
    const currentTabQuickCommands = (
      currentTab.quickCommands || []
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
      activeTabId
    } = this
    const { tabs } = window.store
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) {
      return false
    }
    return tab
  }

  get batchInputSelectedTabIds () {
    return Array.from(window.store._batchInputSelectedTabIds)
  }

  get rightPanelTitle () {
    const {
      rightPanelTab,
      config: {
        baseURLAI
      }
    } = window.store
    if (rightPanelTab === 'ai') {
      return getBrand(baseURLAI).brand || 'Custom AI Model'
    }
    return createTitle(window.store.currentTab)
  }

  get inActiveTerminal () {
    const { store } = window
    if (store.showModal) {
      return false
    }
    const {
      currentTab
    } = store
    if (!currentTab) {
      return false
    }
    const {
      type,
      pane
    } = currentTab
    if (type === 'rdp' || type === 'vnc' || type === 'web') {
      return false
    }
    return pane === paneMap.ssh ||
        pane === paneMap.terminal
  }

  get quickCommandTags () {
    const { quickCommands } = window.store
    return uniq(
      quickCommands.reduce((p, q) => {
        return [
          ...p,
          ...(q.labels || [])
        ]
      }, [])
    )
  }

  get isTransporting () {
    return window.store.tabs.some(t => t.isTransporting)
  }

  get transferCount () {
    return window.store.fileTransfers.length
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
          deepCopy(initItem),
          ...arr
        ]
  }

  get termSearchOptions () {
    const {
      store
    } = window
    const theme = store.getThemeConfig()
    return {
      ...window.store._termSearchOptions,
      decorations: {
        activeMatchBorder: theme.yellow,
        activeMatchBackground: theme.selectionBackground,
        activeMatchColorOverviewRuler: theme.selectionBackground,
        matchBackground: theme.background,
        matchOverviewRuler: theme.yellow,
        matchBorder: getReverseColor(theme.background)
      }
    }
  }

  get tabTitles () {
    return window.store.tabs.map(d => d.title).join('#')
  }

  get setting () {
    return [
      {
        id: settingTerminalId,
        title: e('terminal')
      },
      {
        id: settingShortcutsId,
        title: e('settingShortcuts')
      },
      {
        id: settingSyncId,
        title: e('settingSync')
      }
    ]
  }

  get onOperation () {
    const {
      store
    } = window
    return store.showModal ||
      store.showInfoModal ||
      store.showEditor ||
      store.showFileModal
  }

  get uiThemeConfig () {
    const { store } = window
    const themeConf = store.getUiThemeConfig()
    return {
      token: {
        borderRadius: 3,
        colorPrimary: themeConf.primary,
        colorBgBase: themeConf.main,
        colorError: themeConf.error,
        colorInfo: themeConf.info,
        colorSuccess: themeConf.success,
        colorWarning: themeConf.warn,
        colorTextBase: themeConf.text,
        colorLink: themeConf['text-light']
      },
      algorithm: isColorDark(themeConf.main) ? theme.darkAlgorithm : theme.defaultAlgorithm
    }
  }

  get bookmarkTree () {
    const {
      bookmarks
    } = window.store
    return bookmarks.reduce((p, v) => {
      return {
        ...p,
        [v.id]: v
      }
    }, {})
  }

  hasSshConfig () {
    return !!window.store
      .bookmarkGroups
      .find(b => b.id === terminalSshConfigType)
  }

  get bookmarkGroupTree () {
    const {
      bookmarkGroups
    } = window.store
    return bookmarkGroups.reduce((p, v) => {
      return {
        ...p,
        [v.id]: v
      }
    }, {})
  }

  get hasOldConnectionHoppingBookmark () {
    return window.store.bookmarks.some(b => {
      return b.connectionHoppings?.length && !b.hasHopping
    })
  }
}

loadDataExtend(Store)
eventExtend(Store)
dbUpgradeExtend(Store)
syncExtend(Store)
appUpgradeExtend(Store)
bookmarkGroupExtend(Store)
bookmarkExtend(Store)
commonExtend(Store)
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
addressBookmarkExtend(Store)

export const StateStore = Store
