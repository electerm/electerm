/**
 * central state store powered by manate - https://github.com/tylerlong/manate
 */

import { manage } from 'manate'
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
import addressBookmarkExtend from './address-bookmark'

import { uniq } from 'lodash-es'
import copy from 'json-deep-copy'
import {
  settingMap,
  sidebarWidth,
  sidebarPanelWidth,
  paneMap,
  settingSyncId,
  settingShortcutsId,
  settingTerminalId
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import {
  theme
} from 'antd'

const { prefix } = window
const ss = prefix('settingSync')
const s = prefix('setting')
const sss = prefix('ssh')

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

function expandShorthandColor (color) {
  if (color.length === 4) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }
  return color
}

function isColorDark (_color) {
  let color = expandShorthandColor(_color)
  if (color.charAt(0) === '#') {
    color = color.slice(1) // Remove the '#' if present
  }
  const r = parseInt(color.substr(0, 2), 16)
  const g = parseInt(color.substr(2, 2), 16)
  const b = parseInt(color.substr(4, 2), 16)

  // Formula to determine brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  // Decide based on brightness threshold
  return brightness < 128 // You can adjust this threshold as needed
}

class Store {
  constructor () {
    Object.assign(
      this,
      initState()
    )
  }

  get width () {
    return window.store.innerWidth - sidebarWidth -
      (window.store.pinned ? sidebarPanelWidth : 0)
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
      currentTabId
    } = this
    const tabs = window.store.getTabs()
    const tab = tabs.find(t => t.id === currentTabId)
    if (!tab) {
      return false
    }
    return tab
  }

  get inActiveTerminal () {
    const { store } = window
    return !store.showModal &&
      store.termFocused &&
      store.currentTab &&
      (
        store.currentTab.pane === paneMap.ssh ||
        store.currentTab.pane === paneMap.terminal
      )
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

  get termSearchOptions () {
    const {
      store
    } = window
    const theme = store.getThemeConfig()
    return {
      ...JSON.parse(window.store._termSearchOptions),
      decorations: {
        activeMatchColorOverviewRuler: theme.selectionBackground,
        matchBackground: theme.background,
        matchOverviewRuler: theme.selectionBackground,
        matchBorder: getReverseColor(theme.background)
      }
    }
  }

  get tabTitles () {
    return window.store.getTabs().map(d => d.title).join('#')
  }

  get setting () {
    return [
      {
        id: settingTerminalId,
        title: sss('terminal')
      },
      {
        id: settingShortcutsId,
        title: s('settingShortcuts')
      },
      {
        id: settingSyncId,
        title: ss('settingSync')
      }
    ]
  }

  get config () {
    return JSON.parse(window.store._config || '{}')
  }

  get sftpSortSetting () {
    return JSON.parse(window.store._sftpSortSetting)
  }

  get onOperation () {
    const {
      store
    } = window
    return store.showModal ||
      store.termSearchOpen ||
      store.showInfoModal ||
      store.showEditor ||
      store.showFileModal
  }

  get topMenuHeight () {
    return window.store.config.useSystemTitleBar ? 0 : 15
  }

  get tabsHeight () {
    return 45 // window.store.config.useSystemTitleBar ? 45 : 56
  }

  get langs () {
    return JSON.parse(window.store._langs)
  }

  get upgradeInfo () {
    return JSON.parse(window.store._upgradeInfo)
  }

  get settingItem () {
    return JSON.parse(window.store._settingItem)
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
}

const getterProps = [
  'expandedKeys',
  'checkedKeys',
  'addressBookmarks',
  'addressBookmarksLocal',
  'sshConfigItems',
  'itermThemes',
  'history',
  'bookmarks',
  'bookmarkGroups',
  'tabs',
  'fileTransfers',
  'transferHistory',
  'quickCommands',
  'terminalThemes',
  'serials',
  'fonts'
]

for (const prop of getterProps) {
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
addressBookmarkExtend(Store)

export const StateStore = Store
const store = manage(new Store())

export default store
