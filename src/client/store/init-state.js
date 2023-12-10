/**
 * init static state
 */

import {
  settingMap,
  defaultBookmarkGroupId,
  newBookmarkIdPrefix,
  fileOperationsMap,
  syncTypes,
  infoTabs,
  openedSidebarKey,
  sidebarPinnedKey,
  sftpDefaultSortSettingKey,
  batchInputLsKey,
  expandedKeysLsKey,
  checkedKeysLsKey,
  localAddrBookmarkLsKey,
  leftSidebarWidthKey
} from '../common/constants'
import { buildDefaultThemes, buildNewTheme } from '../common/terminal-theme'
import * as ls from '../common/safe-local-storage'

const { prefix } = window
const t = prefix('terminalThemes')
const e = prefix('control')
const newQuickCommand = 'newQuickCommand'
const q = prefix('quickCommands')

function getDefaultBookmarkGroups (bookmarks) {
  return [
    JSON.stringify({
      title: t(defaultBookmarkGroupId),
      id: defaultBookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    })
  ]
}

export const getInitItem = (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return { id: newBookmarkIdPrefix + ':' + (Date.now()), title: '' }
  } else if (tab === settingMap.setting) {
    return { id: '', title: e('common') }
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  } else if (tab === settingMap.quickCommands) {
    return {
      id: '',
      name: q(newQuickCommand)
    }
  }
}

export default () => {
  return {
    // common
    wsInited: false,
    configLoaded: false,
    loadTime: 0,
    lastDataUpdateTime: 0,
    _tabs: '[]',
    currentTabId: '',
    termFocused: false,
    _history: '[]',
    _bookmarks: '[]',
    _bookmarkGroups: JSON.stringify(
      getDefaultBookmarkGroups([])
    ),
    _config: '{}',
    _terminalThemes: JSON.stringify([
      buildDefaultThemes()
    ]),
    _itermThemes: '[]',
    currentBookmarkGroupId: defaultBookmarkGroupId,
    _expandedKeys: ls.getItem(expandedKeysLsKey) || JSON.stringify([
      defaultBookmarkGroupId
    ]),
    bookmarkSelectMode: false,
    _checkedKeys: ls.getItem(checkedKeysLsKey) || '[]',
    _addressBookmarks: '[]',
    _addressBookmarksLocal: ls.getItem(localAddrBookmarkLsKey) || '[]',

    // init session control
    selectedSessions: [],
    sessionModalVisible: false,

    // sftp
    fileOperation: fileOperationsMap.cp, // cp or mv
    transferTab: 'transfer',
    _transferHistory: '[]',
    _fileTransfers: '[]',
    _sftpSortSetting: ls.getItem(sftpDefaultSortSettingKey) || JSON.stringify({
      local: {
        prop: 'modifyTime',
        direction: 'asc'
      },
      remote: {
        prop: 'modifyTime',
        direction: 'desc'
      }
    }),

    // for settings related
    _setting: '',
    _settingItem: JSON.stringify(getInitItem([], settingMap.bookmarks)),
    settingTab: settingMap.bookmarks, // setting tab
    autofocustrigger: Date.now(),
    bookmarkId: undefined,
    showModal: 0,
    activeTerminalId: '',

    // setting sync related
    isSyncingSetting: false,
    isSyncUpload: false,
    isSyncDownload: false,
    syncSetting: {},
    syncType: syncTypes.github,
    _fonts: '[]',

    // term search
    termSearchOpen: false,
    termSearch: '',
    termSearchMatchCount: 0,
    termSearchMatchIndex: 0,
    _termSearchOptions: JSON.stringify({
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      decorations: {
        activeMatchColorOverviewRuler: 'yellow'
      }
    }),

    // quick commands
    _quickCommands: '[]',
    quickCommandId: '',
    openQuickCommandBar: false,
    pinnedQuickCommandBar: false,

    // sidebar
    openedSideBar: ls.getItem(openedSidebarKey),
    leftSidebarWidth: parseInt(ls.getItem(leftSidebarWidthKey), 10) || 300,
    menuOpened: false,
    pinned: ls.getItem(sidebarPinnedKey) === 'true',

    // info/help modal
    showInfoModal: false,
    infoModalTab: infoTabs.info,
    commandLineHelp: '',

    // editor
    showEditor: false,

    // file/info modal
    showFileModal: false,

    // update
    _upgradeInfo: '{}',

    // serial list related
    _serials: '[]',
    loaddingSerials: false,

    // transfer list
    transports: [],

    _sshConfigItems: '[]',

    appPath: '',
    exePath: '',
    isPortable: false,
    installSrc: '',

    _langs: '[]',

    // batch inputs
    batchInputs: ls.getItemJSON(batchInputLsKey, []),

    // ui
    innerWidth: window.innerWidth,
    height: 500,
    isMaximized: window.pre.runSync('isMaximized'),
    terminalFullScreen: false
  }
}
