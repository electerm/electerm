/**
 * constants
 */

const buildConst = (props) => {
  return props.reduce((prev, key) => {
    return {
      ...prev,
      [key]: key
    }
  }, {})
}
export const logoPath1 = require('node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png').replace(/^\//, '')
export const logoPath2 = require('node_modules/@electerm/electerm-resource/res/imgs/electerm.png').replace(/^\//, '')
export const maxEditFileSize = 1024 * 30
export const defaultUserName = 'root'
export const defaultookmarkGroupId = 'default'
export const maxBookmarkGroupTitleLength = 33
export const termControlHeight = 33
export const maxDragMove = 30
export const splitDraggerWidth = 5
export const minTerminalWidth = 90
export const filePropMinWidth = 1
export const contextMenuHeight = 28
export const contextMenuWidth = 120
export const contextMenuPaddingTop = 10
export const sftpControlHeight = 28 + 42 + 6 + 33
export const sidebarWidth = 43
export const maxHistory = 50

export const maxSftpHistory = 20

//export const maxTabs = 20

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

export const authTypeMap = buildConst([
  'password',
  'privateKey'
])

export const maxTransferHistory = 100
export const topMenuHeight = 48
export const tabsHeight = 56

const platform = window.getGlobal('os').platform()
export const isWin = platform.startsWith('win')
export const isMac = platform.startsWith('darwin')
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
  'bookmarkGroups'
])

export const transferTypeMap = buildConst([
  'download',
  'upload'
])

export const fileOpTypeMap = buildConst([
  'copy',
  'mv'
])


export const terminalSplitDirectionMap = buildConst([
  'horizontal',
  'vertical'
])

export const terminalSshConfigType = 'ssh-config'

// https://github.com/tinkertrain/panda-syntax-vscode/blob/master/themes/workbench.yaml
export const defaultTheme = {
  id: 'default',
  name: 'default',
  themeConfig: {
    foreground: '#bbbbbb',
    background: '#000000',
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
  }
}

export const eventTypes = {
  resetFileListTable: 'reset-file-list-table'
}
