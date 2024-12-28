/**
 * central state store powered by manate - https://github.com/tylerlong/manate
 */

import { manage } from 'manate'
import initState from './init-state'
import loadDataExtend from './load-data'
import dbUpgradeExtend from './db-upgrade'
import eventExtend from './event'
import syncExtend from './sync'
import appUpgradeExtend from './app-upgrade'
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
import addressBookmarkExtend from './address-bookmark'
import isColorDark from '../common/is-color-dark'

import { uniq } from 'lodash-es'
import deepCopy from 'json-deep-copy'
import {
  settingMap,
  paneMap,
  settingSyncId,
  settingShortcutsId,
  settingTerminalId
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import {
  theme
} from 'antd'

const e = window.translate

function getReverseColor (hex) {
  // Check if the input is a valid hex color code
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return '#0088cc'
  }
  // Convert the hex color code to an integer
  const num = parseInt(hex.slice(1), 16)
  // Bitwise XOR the integer with 0xFFFFFF to get the reverse color
  const reverse = num ^ 0xFFFFFF
  // Convert the reverse color to a hex string and pad with zeros if needed
  return '#' + reverse.toString(16).padStart(6, '0')
}

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
}

const arrGetterProps = [
  'expandedKeys',
  'checkedKeys',
  'addressBookmarks',
  'addressBookmarksLocal',
  'sshConfigItems',
  'itermThemes',
  'bookmarks',
  'bookmarkGroups',
  'profiles',
  'quickCommands',
  'terminalThemes',
  'resolutions'
]

for (const prop of arrGetterProps) {
  Object.defineProperty(Store.prototype, prop, {
    get: function () {
      return JSON.parse(window.store[`_${prop}`] || '[]').filter(d => d)
    }
  })
}

loadDataExtend(Store)
eventExtend(Store)
dbUpgradeExtend(Store)
syncExtend(Store)
appUpgradeExtend(Store)
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
addressBookmarkExtend(Store)

export const StateStore = Store
const store = manage(new Store())

export default store
