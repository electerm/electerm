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
export const maxEditFileSize = 1024 * 3000
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
export const sftpControlHeight = 42 + 30
export const sidebarWidth = 43
export const maxHistory = 50
export const maxTransport = 1
export const maxSftpHistory = 20
export const maxZoom = 8
export const minZoom = 0.5
export const extraTabWidth = 113

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
  'local',
  'web',
  'rdp',
  'vnc'
])

export const authTypeMap = buildConst([
  'password',
  'privateKey',
  'profiles'
])

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
  'terminalThemes',
  'bookmarkGroups',
  'quickCommands',
  'addressBookmarks',
  'profiles'
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

export const terminalSshConfigType = 'ssh-config'
export const terminalWebType = 'web'
export const terminalRdpType = 'rdp'
export const terminalVncType = 'vnc'
export const terminalSerialType = 'serial'
export const terminalTelnetType = 'telnet'
export const terminalLocalType = 'local'
export const openedSidebarKey = 'opened-sidebar'
export const sidebarPinnedKey = 'sidebar-pinned'
export const leftSidebarWidthKey = 'left-sidebar-width'
export const rightSidebarWidthKey = 'right-sidebar-width'
export const sftpDefaultSortSettingKey = 'sftp-default-sort'
export const qmSortByFrequencyKey = 'qm-sort-by-frequency'
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
  'custom',
  'cloud'
])
export const syncTokenCreateUrls = {
  gitee: 'https://gitee.com/github-zxdong262/electerm/wikis/Create%20personal%20access%20token?sort_id=3028409',
  github: 'https://github.com/electerm/electerm/wiki/Create-personal-access-token',
  custom: 'https://github.com/electerm/electerm/wiki/Custom-sync-server',
  cloud: 'https://electerm-cloud.html5beta.com'
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
export const fileActions = {
  cancel: 'cancel',
  skip: 'skip',
  skipAll: 'skipAll',
  mergeOrOverwrite: 'mergeOrOverwrite',
  rename: 'rename',
  mergeOrOverwriteAll: 'mergeOrOverwriteAll',
  renameAll: 'renameAll'
}

export const srcsSkipUpgradeCheck = [
  '.appx',
  '.snap',
  'skip-upgrade-check'
]
export const termLSPrefix = 'term:sess:'
export const batchInputLsKey = 'batch-inputs'
export const rendererTypes = {
  dom: 'dom',
  canvas: 'canvas',
  webGL: 'webGL'
}
export const mirrors = {
  'download-electerm': 'download-electerm',
  github: 'github',
  sourceforge: 'sourceforge'
}
export const downloadUpgradeTimeout = 20000
export const expandedKeysLsKey = 'expanded-keys'
export const resolutionsLsKey = 'custom-resolution-key'
export const checkedKeysLsKey = 'checked-keys'
export const quickCommandLabelsLsKey = 'quick-command-labels'
export const localAddrBookmarkLsKey = 'local-addr-bookmark-keys'
export const dismissDelKeyTipLsKey = 'dismiss-del-key-tip'
export const sshTunnelHelpLink = 'https://github.com/electerm/electerm/wiki/How-to-use-ssh-tunnel'
export const batchOpHelpLink = 'https://github.com/electerm/electerm/wiki/batch-operation'
export const proxyHelpLink = 'https://github.com/electerm/electerm/wiki/proxy-format'
export const regexHelpLink = 'https://github.com/electerm/electerm/wiki/Terminal-keywords-highlight-regular-expression-exmaples'
export const connectionHoppingWikiLink = 'https://github.com/electerm/electerm/wiki/Connection-Hopping-Behavior-Change-in-electerm-since-v1.50.65'
export const aiConfigWikiLink = 'https://github.com/electerm/electerm/wiki/AI-model-config-guide'
export const rdpWikiLink = 'https://github.com/electerm/electerm/wiki/RDP-session-known-issues'
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
  'getFolderSize',
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
export const cwdId = '=__+__'
export const zmodemTransferPackSize = 1024 * 1024 * 2
export const splitMap = {
  c1: 'c1',
  c2: 'c2',
  c3: 'c3',
  r2: 'r2',
  r3: 'r3',
  c2x2: 'c2x2',
  c1r2: 'c1r2',
  r1c2: 'r1c2'
}
export const splitMapDesc = {
  c1: 'single',
  c2: 'twoColumns',
  c3: 'threeColumns',
  r2: 'twoRows',
  r3: 'threeRows',
  c2x2: 'grid2x2',
  c1r2: 'twoRowsRight',
  r1c2: 'twoColumnsBottom'
}
export const splitConfig = {
  c1: {
    children: 1,
    handle: 0
  },
  c2: {
    children: 2,
    handle: 1
  },
  c3: {
    children: 3,
    handle: 2
  },
  r2: {
    children: 2,
    handle: 1
  },
  r3: {
    children: 3,
    handle: 2
  },
  c2x2: {
    children: 4,
    handle: 3
  },
  c1r2: {
    children: 3,
    handle: 2
  },
  r1c2: {
    children: 3,
    handle: 2
  }
}
export const syncDataMaps = {
  settings: ['config'],
  bookmarks: ['bookmarks', 'bookmarkGroups'],
  terminalThemes: ['terminalThemes'],
  quickCommands: ['quickCommands'],
  profiles: ['profiles'],
  addressBookmarks: ['addressBookmarks']
}
export const terminalTypes = [
  'xterm-256color',
  'xterm-new',
  'xterm-color',
  'xterm-vt220',
  'xterm',
  'linux',
  'vt100',
  'ansi',
  'rxvt'
]
export const sshConfigLoadKey = 'ssh-config-loaded'
export const sshConfigKey = 'ignore-ssh-config'
export const connectionHoppingWarnKey = 'connectionHoppingWarnned'
export const aiChatHistoryKey = 'ai-chat-history'
export const syncServerDataKey = 'sync-server-data'
