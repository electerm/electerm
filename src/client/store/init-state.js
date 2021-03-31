/**
 * init static state
 */

// import newTerm from '../common/new-terminal'
import copy from 'json-deep-copy'
import {
  settingMap,
  defaultBookmarkGroupId,
  sidebarWidth,
  newBookmarkIdPrefix,
  syncTypes,
  settingSyncId,
  sshConfigItems,
  infoTabs
} from '../common/constants'
import { buildDefaultThemes, buildNewTheme } from '../common/terminal-theme'

const { _config } = window
const { prefix } = window
const t = prefix('terminalThemes')
const e = prefix('control')
const newQuickCommand = 'newQuickCommand'
const q = prefix('quickCommands')
const ss = prefix('settingSync')

function getDefaultBookmarkGroups (bookmarks) {
  return [
    {
      title: t(defaultBookmarkGroupId),
      id: defaultBookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    }
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
  lastDataUpdateTime: 0,
  tabs,
  height: 500,
  width: window.innerWidth - sidebarWidth,
  currentTabId: '',
  history: [],
  quickCommands: [],
  quickCommandId: '',
  bookmarks,
  bookmarkGroups,
  setting: [
    {
      id: settingSyncId,
      title: ss('settingSync')
    }
  ],
  sshConfigItems,
  isMaximized: window.pre.runSync('isMaximized'),
  config: copy(_config) || {},
  contextMenuProps: {},
  transferHistory: [],
  terminalThemes: [buildDefaultThemes()],
  contextMenuVisible: false,
  fileInfoModalProps: {},
  fileModeModalProps: {},
  currentBookmarkGroupId: defaultBookmarkGroupId,
  transferHistoryModalVisible: false,
  selectedSessions: [],
  sessionModalVisible: false,
  textEditorProps: {},
  settingItem: getInitItem([], settingMap.bookmarks),

  // for settings related
  tab: settingMap.bookmarks, // setting tab
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
  fonts: [],

  // sidebar
  openedSideBar: '',
  openedCategoryIds: [],
  menuOpened: false,
  pinned: false,

  // info/help modal
  showInfoModal: false,
  infoModalTab: infoTabs.info,
  commandLineHelp: '',

  // update
  upgradeInfo: {},

  // serial list related
  serials: [],
  loaddingSerials: false,

  // transfer list
  transports: [],

  // batch inputs
  batchInputs: [],

  // ui
  terminalFullScreen: false
}
