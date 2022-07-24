/**
 * init static state
 */

// import newTerm from '../common/new-terminal'
import {
  settingMap,
  defaultBookmarkGroupId,
  newBookmarkIdPrefix,
  fileOperationsMap,
  syncTypes,
  settingSyncId,
  infoTabs,
  openedSidebarKey,
  sidebarPinnedKey,
  sftpDefaultSortSettingKey,
  batchInputLsKey
} from '../common/constants'
import { buildDefaultThemes, buildNewTheme } from '../common/terminal-theme'
import * as ls from '../common/safe-local-storage'

const { prefix } = window
const t = prefix('terminalThemes')
const e = prefix('control')
const newQuickCommand = 'newQuickCommand'
const q = prefix('quickCommands')
const ss = prefix('settingSync')

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
    return { id: newBookmarkIdPrefix + ':' + (+new Date()), title: '' }
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

const tabs = []
const bookmarks = []
const bookmarkGroups = getDefaultBookmarkGroups(bookmarks)

export default {
  // common
  loadTime: 0,
  lastDataUpdateTime: 0,
  tabs,
  currentTabId: '',
  history: [],
  bookmarks,
  bookmarkGroups,
  _config: '{}',
  terminalThemes: [
    JSON.stringify(buildDefaultThemes())
  ],
  itermThemes: [],

  currentBookmarkGroupId: defaultBookmarkGroupId,

  // init session control
  selectedSessions: [],
  sessionModalVisible: false,

  // sftp
  fileOperation: fileOperationsMap.cp, // cp or mv
  transferTab: 'transfer',
  transferHistory: [],
  fileTransfers: [
  ],
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
  setting: [
    {
      id: settingSyncId,
      title: ss('settingSync')
    }
  ],
  settingItem: getInitItem([], settingMap.bookmarks),
  settingTab: settingMap.bookmarks, // setting tab
  autofocustrigger: +new Date(),
  bookmarkId: undefined,
  showModal: false,
  activeTerminalId: '',

  // setting sync related
  isSyncingSetting: false,
  isSyncUpload: false,
  isSyncDownload: false,
  syncSetting: {},
  syncType: syncTypes.github,
  _fonts: [],

  // term search
  termSearchOpen: false,
  termSearch: '',
  termSearchOptions: {
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

  // sidebar
  openedSideBar: ls.getItem(openedSidebarKey),
  openedCategoryIds: [],
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

  // transfer list
  transports: [],

  _sshConfigItems: [],

  appPath: '',

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
