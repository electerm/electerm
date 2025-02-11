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
  aiChatHistoryKey,
  syncServerDataKey,
  splitMap
} from '../common/constants'
import { buildDefaultThemes } from '../common/terminal-theme'
import * as ls from '../common/safe-local-storage'
import { exclude } from 'manate'
import initSettingItem from '../common/init-setting-item'

const e = window.translate

function getDefaultBookmarkGroups (bookmarks) {
  return [
    JSON.stringify({
      title: e(defaultBookmarkGroupId),
      id: defaultBookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    })
  ]
}

export default () => {
  const layout = ls.getItem('layout') || splitMap.c1
  return {
    // common
    wsInited: false,
    configLoaded: false,
    loadTime: 0,
    lastDataUpdateTime: 0,
    tabs: [],
    activeTabId: '',
    history: ls.getItemJSON('history', []),
    sshConfigs: [],
    bookmarks: [],
    bookmarksMap: new Map(),
    sidebarPanelTab: 'bookmarks',
    profiles: [],
    bookmarkGroups: getDefaultBookmarkGroups([]),
    _config: {},
    terminalThemes: [
      buildDefaultThemes()
    ],
    itermThemes: exclude([]),
    currentBookmarkGroupId: defaultBookmarkGroupId,
    expandedKeys: ls.getItemJSON(expandedKeysLsKey, [
      defaultBookmarkGroupId
    ]),
    bookmarkSelectMode: false,
    checkedKeys: ls.getItemJSON(checkedKeysLsKey, []),
    addressBookmarks: [],
    addressBookmarksLocal: ls.getItemJSON(localAddrBookmarkLsKey, []),
    openResolutionEdit: false,
    resolutions: ls.getItemJSON(resolutionsLsKey, []),

    // init session control
    selectedSessions: [],
    sessionModalVisible: false,

    // batch input selected tab ids
    _batchInputSelectedTabIds: new Set(),
    showAIConfig: false,
    aiChatHistory: ls.getItemJSON(aiChatHistoryKey, []),

    // sftp
    fileOperation: fileOperationsMap.cp, // cp or mv
    pauseAllTransfer: false,
    transferTab: 'transfer',
    transferHistory: [],
    fileTransfers: [],
    transferToConfirm: {},
    sftpSortSetting: ls.getItemJSON(sftpDefaultSortSettingKey, {
      local: {
        prop: 'modifyTime',
        direction: 'desc'
      },
      remote: {
        prop: 'modifyTime',
        direction: 'desc'
      }
    }),
    layout,
    prevLayout: layout,
    resizeTrigger: 0,
    currentLayoutBatch: 0,
    activeTabId0: '',
    activeTabId1: '',
    activeTabId2: '',
    activeTabId3: '',
    terminalInfoProps: {},
    rightPanelVisible: false,
    rightPanelTab: 'info',
    rightPanelPinned: false,
    rightPanelWidth: parseInt(ls.getItem(rightSidebarWidthKey), 10) || 500,

    // for settings related
    _setting: '',
    settingItem: initSettingItem([], settingMap.bookmarks),
    settingTab: settingMap.bookmarks, // setting tab
    bookmarkId: undefined,
    showModal: 0,

    // setting sync related
    isSyncingSetting: false,
    isSyncUpload: false,
    isSyncDownload: false,
    syncType: syncTypes.github,
    // syncServerData: {},
    syncServerStatus: ls.getItemJSON(syncServerDataKey, {}),

    // term search
    termSearchOpen: false,
    termSearch: '',
    termSearchMatchCount: 0,
    termSearchMatchIndex: 0,
    _termSearchOptions: {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      decorations: {
        activeMatchColorOverviewRuler: 'yellow'
      }
    },

    // quick commands
    quickCommands: [],
    quickCommandId: '',
    openQuickCommandBar: false,
    pinnedQuickCommandBar: false,
    qmSortByFrequency: ls.getItem(qmSortByFrequencyKey) === 'yes',

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
    upgradeInfo: {},

    // serial list related
    serials: [],
    loaddingSerials: false,

    appPath: '',
    exePath: '',
    isPortable: false,
    installSrc: '',
    showSshConfigModal: false,

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
