/**
 * init static state
 */

import {
  settingMap,
  defaultBookmarkGroupId,
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
  leftSidebarWidthKey,
  rightSidebarWidthKey,
  dismissDelKeyTipLsKey,
  qmSortByFrequencyKey,
  resolutionsLsKey,
  splitMap
} from '../common/constants'
import { buildDefaultThemes } from '../common/terminal-theme'
import * as ls from '../common/safe-local-storage'
import initSettingItem from '../common/init-setting-item'

const { prefix } = window
const t = prefix('terminalThemes')

function getDefaultBookmarkGroups (bookmarks) {
  return [
    JSON.stringify({
      title: t(defaultBookmarkGroupId),
      id: defaultBookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    })
  ]
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
    _profiles: '[]',
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
    openResolutionEdit: false,
    _resolutions: ls.getItem(resolutionsLsKey) || '[]',

    // init session control
    selectedSessions: [],
    sessionModalVisible: false,

    // sftp
    fileOperation: fileOperationsMap.cp, // cp or mv
    pauseAllTransfer: false,
    transferTab: 'transfer',
    _transferHistory: '[]',
    _fileTransfers: '[]',
    _transferToConfirm: '{}',
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
    layout: splitMap.c1,
    prevLayout: '',
    currentLayoutBatch: 0,
    currentTabId0: '',
    currentTabId1: '',
    currentTabId2: '',
    currentTabId3: '',

    // for settings related
    _setting: '',
    _settingItem: JSON.stringify(initSettingItem([], settingMap.bookmarks)),
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
    qmSortByFrequency: ls.getItem(qmSortByFrequencyKey) === 'yes',

    // sidebar
    openedSideBar: ls.getItem(openedSidebarKey),
    leftSidebarWidth: parseInt(ls.getItem(leftSidebarWidthKey), 10) || 300,
    rightSidebarWidth: parseInt(ls.getItem(rightSidebarWidthKey), 10) || 500,
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
    terminalFullScreen: false,
    hideDelKeyTip: ls.getItem(dismissDelKeyTipLsKey) === 'y',
    tabsHeight: 36
  }
}
