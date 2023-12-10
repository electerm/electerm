/**
 * constants
 */
import { getUiThemeConfig } from './ui-theme'
import logoPath1Ref from '@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
import logoPath2Ref from '@electerm/electerm-resource/res/imgs/electerm.png'
import logoPath3Ref from '@electerm/electerm-resource/res/imgs/electerm-watermark.png'
import dbDefaults from './db-defaults'
import { get as _get } from 'lodash-es'
export const packInfo = typeof window.et.packInfo === 'undefined' ? window.pre.packInfo : window.et.packInfo
const buildConst = (props) => {
  return props.reduce((prev, key) => {
    return {
      ...prev,
      [key]: key
    }
  }, {})
}

export const logoPath1 = logoPath1Ref.replace(/^\//, '')
export const logoPath2 = logoPath2Ref.replace(/^\//, '')
export const logoPath3 = logoPath3Ref.replace(/^\//, '')
export const maxEditFileSize = 1024 * 30
export const defaultBookmarkGroupId = 'default'
export const newBookmarkIdPrefix = 'new-bookmark'
export const unexpectedPacketErrorDesc = 'Unexpected packet'
export const noTerminalBgValue = 'no-termimal-bg'
export const sftpRetryInterval = 3000
export const maxBookmarkGroupTitleLength = 33
export const termControlHeight = 32
export const maxDragMove = 30
export const splitDraggerWidth = 5
export const minTerminalWidth = 90
export const filePropMinWidth = 1
export const contextMenuHeight = 28
export const contextMenuWidth = 280
export const contextMenuPaddingTop = 10
export const sftpControlHeight = 28 + 42 + 33 + 46
export const sidebarWidth = 43
export const sidebarPanelWidth = 300
export const maxHistory = 50
export const maxTransport = 5
export const maxSftpHistory = 20
export const maxZoom = 8
export const minZoom = 0.25
export const extraTabWidth = 113
// export const maxTabs = 20

export const tabWidth = 160

export const tabMargin = 1

export const fileTypeMap = {
  link: 'l',
  directory: 'd'
}

export const statusMap = buildConst([
  'default',
  'success',
  'error',
  'processing',
  'warning'
])

export const connectionMap = buildConst([
  'ssh',
  'telnet',
  'serial',
  'local'
])

export const authTypeMap = buildConst([
  'password',
  'privateKey'
])

export const maxTransferHistory = 100
export const footerHeight = 36
export const quickCommandBoxHeight = 180
export const isWin = typeof window.et.isWin === 'undefined' ? window.pre.isWin : window.et.isWin
export const isMac = typeof window.et.isMac === 'undefined' ? window.pre.isMac : window.et.isMac
export const isMacJs = /Macintosh|Mac|Mac OS|MacIntel|MacPPC|Mac68K/gi.test(window.navigator.userAgent)
export const ctrlOrCmd = isMacJs ? 'cmd' : 'ctrl'
export const typeMap = buildConst([
  'remote',
  'local'
])

export const paneMap = buildConst([
  'ssh',
  'sftp',
  'terminal',
  'fileManager'
])

export const settingMap = buildConst([
  'setting',
  'bookmarks',
  'history',
  'terminalThemes',
  'bookmarkGroups',
  'quickCommands',
  'addressBookmarks'
])

export const infoTabs = buildConst([
  'info',
  'deps',
  'env',
  'os',
  'log',
  'cmd'
])

export const transferTypeMap = buildConst([
  'download',
  'upload',
  'remote',
  'local',
  'compressAndDownload',
  'compressAndUpload'
])

export const fileOperationsMap = buildConst([
  'cp',
  'mv'
])

export const terminalSplitDirectionMap = buildConst([
  'horizontal',
  'vertical'
])

export const terminalSshConfigType = 'ssh-config'
export const terminalSerialType = 'serial'
export const terminalTelnetType = 'telnet'
export const terminalLocalType = 'local'
export const openedSidebarKey = 'opened-sidebar'
export const sidebarPinnedKey = 'sidebar-pinned'
export const leftSidebarWidthKey = 'left-sidebar-width'
export const sftpDefaultSortSettingKey = 'sftp-default-sort'
// https://github.com/tinkertrain/panda-syntax-vscode/blob/master/themes/workbench.yaml
export const defaultTheme = {
  id: 'default',
  name: 'default',
  themeConfig: {
    foreground: '#bbbbbb',
    background: '#141314',
    cursor: '#b5bd68',
    cursorAccent: '#1d1f21',
    selectionBackground: 'rgba(255, 255, 255, 0.3)',
    black: '#575757',
    red: '#FF2C6D',
    green: '#19f9d8',
    yellow: '#FFB86C',
    blue: '#45A9F9',
    magenta: '#FF75B5',
    cyan: '#B084EB',
    white: '#CDCDCD',
    brightBlack: '#757575',
    brightRed: '#FF2C6D',
    brightGreen: '#19f9d8',
    brightYellow: '#FFCC95',
    brightBlue: '#6FC1FF',
    brightMagenta: '#FF9AC1',
    brightCyan: '#BCAAFE',
    brightWhite: '#E6E6E6'
  },
  uiThemeConfig: getUiThemeConfig(window.et.stylus)
}

export const eventTypes = {
  resetFileListTable: 'reset-file-list-table'
}

export const commonBaudRates = [
  110,
  300,
  1200,
  2400,
  4800,
  9600,
  14400,
  19200,
  38400,
  57600,
  115200
]

export const commonDataBits = [
  8, 7, 6, 5
]

export const commonStopBits = [
  1, 2
]

export const commonParities = [
  'none', 'even', 'mark', 'odd', 'space'
]

export const maxBatchInput = 30
export const windowControlWidth = 94
export const baseUpdateCheckUrls = [
  packInfo.homepage,
  'https://gitee.com/github-zxdong262/electerm/raw/gh-pages'
]
export const syncTypes = buildConst([
  'github',
  'gitee',
  'custom'
])
export const syncTokenCreateUrls = {
  gitee: 'https://gitee.com/github-zxdong262/electerm/wikis/Create%20personal%20access%20token?sort_id=3028409',
  github: 'https://github.com/electerm/electerm/wiki/Create-personal-access-token',
  custom: 'https://github.com/electerm/electerm/wiki/Custom-sync-server'
}
export const settingSyncId = 'setting-sync'
export const settingTerminalId = 'setting-terminal'
export const settingShortcutsId = 'setting-shortcuts'
export const settingCommonId = 'setting-common'
export const defaultEnvLang = 'en_US.UTF-8'
const defaultThemeLightConf = _get(
  dbDefaults, '[0].data[1]'
)
defaultThemeLightConf.id = defaultThemeLightConf._id
export const defaultThemeLight = defaultThemeLightConf
export const terminalActions = {
  showInfoPanel: 'show-info-panel',
  changeEncode: 'change-encode',
  batchInput: 'batch-input',
  quickCommand: 'quick-command',
  openTerminalSearch: 'open-terminal-search',
  doSearchNext: 'do-search-next',
  doSearchPrev: 'do-search-prev',
  zoom: 'zoom-terminal'
}
export const fileActions = {
  cancel: 'cancel',
  skip: 'skip',
  skipAll: 'skipAll',
  mergeOrOverwrite: 'mergeOrOverwrite',
  rename: 'rename',
  mergeOrOverwriteAll: 'mergeOrOverwriteAll',
  renameAll: 'renameAll'
}

export const tabActions = {
  updateTabsStatus: 'update-tabs-status',
  setAllTabOffline: 'set-all-tab-offline',
  changeCurrentTabId: 'changeCurrentTabId',
  onDuplicateTab: 'on-duplicate-tab',
  reloadTab: 'reload-tab',
  initFirstTab: 'init-first-tab',
  delTab: 'del-tab',
  addTab: 'add-tab',
  updateTabs: 'update-tabs'
}

export const commonActions = {
  returnTermLogState: 'return-term-log-state',
  getTermLogState: 'get-term-log-state',
  setTermLogState: 'set-term-log-state',
  batchOp: 'batch-op',
  updateStore: 'update-store',
  editWithSystemEditorDone: 'edit-with-system-editor-done',
  editWithSystemEditor: 'edit-with-system-editor',
  onCloseTextEditor: 'on-close-text-editor',
  submitTextEditorText: 'submit-text-editor-text',
  fetchTextEditorText: 'fetch-text-editor-text',
  loadTextEditorText: 'load-text-editor-text',
  openTextEditor: 'open-text-editor',
  submitFileModeEdit: 'submit-file-mode-edit',
  showFileModeModal: 'show-file-mode-modal',
  showFileInfoModal: 'show-file-info-modal',
  appUpdateCheck: 'check-app-update',
  closeContextMenu: 'close-context-menu',
  clickContextMenu: 'click-context-menu',
  openContextMenu: 'open-context-menu',
  addTransfer: 'add-transfer'
}

export const srcsSkipUpgradeCheck = [
  '.appx',
  '.snap',
  'skip-upgrade-check'
]
export const termLSPrefix = 'term:sess:'
export const termInitId = 'electerm-init-term'
export const batchInputLsKey = 'batch-inputs'
export const copyBookmarkItemPrefix = 'bookmark:'
export const copyBookmarkGroupItemPrefix = 'bookmarkGroup:'
export const rendererTypes = {
  dom: 'dom',
  canvas: 'canvas',
  webGL: 'webGL'
}
export const mirrors = {
  github: 'github',
  sourceforge: 'sourceforge'
}
export const downloadUpgradeTimeout = 20000
export const expandedKeysLsKey = 'expanded-keys'
export const checkedKeysLsKey = 'checked-keys'
export const quickCommandLabelsLsKey = 'quick-command-labels'
export const localAddrBookmarkLsKey = 'local-addr-bookmark-keys'
export const sshTunnelHelpLink = 'https://github.com/electerm/electerm/wiki/How-to-use-ssh-tunnel'
export const batchOpHelpLink = 'https://github.com/electerm/electerm/wiki/batch-operation'
export const proxyHelpLink = 'https://github.com/electerm/electerm/wiki/proxy-format'
export const regexHelpLink = 'https://github.com/electerm/electerm/wiki/Terminal-keywords-highlight-regular-expression-exmaples'
export const modals = {
  hide: 0,
  setting: 1,
  batchOps: 2
}
export const instSftpKeys = [
  'connect',
  'list',
  'download',
  'upload',
  'mkdir',
  'getHomeDir',
  'rmdir',
  'stat',
  'lstat',
  'chmod',
  'rename',
  'rm',
  'touch',
  'readlink',
  'realpath',
  'mv',
  'cp',
  'readFile',
  'writeFile'
]
