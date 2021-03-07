/**
 * constants
 */
import { getUiThemeConfig } from './ui-theme'
import logoPath1Ref from '@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
import logoPath2Ref from '@electerm/electerm-resource/res/imgs/electerm.png'
import logoPath3Ref from '@electerm/electerm-resource/res/imgs/electerm-watermark.png'
import newTerm from '../common/new-terminal'
import dbDefaults from '../../app/upgrade/db-defaults'
import _ from 'lodash'

export const { packInfo } = window.pre

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
export const defaultUserName = 'root'
export const defaultBookmarkGroupId = 'default'
export const newBookmarkIdPrefix = 'new-bookmark'
export const unexpectedPacketErrorDesc = 'Unexpected packet'
export const noTerminalBgValue = 'no-termimal-bg'
export const sftpRetryInterval = 3000
export const maxBookmarkGroupTitleLength = 33
export const termControlHeight = 33
export const maxDragMove = 30
export const splitDraggerWidth = 5
export const minTerminalWidth = 90
export const filePropMinWidth = 1
export const contextMenuHeight = 28
export const contextMenuWidth = 170
export const contextMenuPaddingTop = 10
export const sftpControlHeight = 28 + 42 + 33 + 56
export const sidebarWidth = 43
export const maxHistory = 50
export const maxTransport = 5
export const maxSftpHistory = 20
export const maxZoom = 8
export const minZoom = 0.25
export const extraTabWidth = 113
// export const maxTabs = 20

export const tabWidth = 160

export const tabMargin = 3

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
  // 'serial',
  'local'
])

export const authTypeMap = buildConst([
  'password',
  'privateKey'
])

export const maxTransferHistory = 100
export const topMenuHeight = 15
export const tabsHeight = 56

export const isWin = window.pre.isWin
export const isMac = window.pre.isMac
export const ctrlOrCmd = isMac ? 'cmd' : 'ctrl'
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
  'quickCommands'
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
  'local'
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
export const terminalLocalType = 'local'

// https://github.com/tinkertrain/panda-syntax-vscode/blob/master/themes/workbench.yaml
export const defaultTheme = {
  id: 'default',
  name: 'default',
  themeConfig: {
    foreground: '#bbbbbb',
    background: '#141314',
    cursor: '#b5bd68',
    cursorAccent: '#1d1f21',
    selection: 'rgba(255, 255, 255, 0.3)',
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

export const defaultLoginScriptDelay = 500

export const initTabs = [newTerm()]
export const appPath = window.pre.appPath
export const maxBatchInput = 30
export const baseUpdateCheckUrls = [
  'https://electerm.github.io/electerm',
  'https://gitee.com/github-zxdong262/electerm/raw/gh-pages'
]
export const syncTypes = buildConst([
  'github',
  'gitee'
])
export const syncTokenCreateUrls = {
  gitee: 'https://gitee.com/github-zxdong262/electerm/wikis/Create%20personal%20access%20token?sort_id=3028409',
  github: 'https://github.com/electerm/electerm/wiki/Create-personal-access-token'
}
export const settingSyncId = 'setting-sync'
export const settingCommonId = 'setting-common'
export const defaultEnvLang = 'en_US.UTF-8'
export const appUpdateCheck = 'check-app-update'
export const maxZmodemUploadSize = 1024 * 8192
export const sshConfigItems = window.pre.sshConfigItems
export const langs = window.langs
const defaultThemeLightConf = _.get(
  dbDefaults, '[0].data[1]'
)
defaultThemeLightConf.id = defaultThemeLightConf._id
export const defaultThemeLight = defaultThemeLightConf
