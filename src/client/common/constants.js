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

export const logoPath1 = require('node_modules/electerm-resource/res/imgs/electerm-round-128x128.png').replace(/^\//, '')
export const logoPath2 = require('node_modules/electerm-resource/res/imgs/electerm.png').replace(/^\//, '')
export const maxEditFileSize = 1024 * 30
export const defaultUserName = 'root'
export const defaultBookmarkGroupId = 'default'
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
export const tabsHeight = 46

const platform = window.getGlobal('os').platform()
export const isWin = platform.startsWith('win')
export const isMac = platform.startsWith('darwin')

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

//from https://github.com/dracula/visual-studio-code/blob/1ed7de8f19dd18223fad8cc495f406742fbbfda6/src/dracula.yml
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
    red: '#FF6E67',
    green: '#5AF78E',
    yellow: '#F4F99D',
    blue: '#CAA9FA',
    magenta: '#FF92D0',
    cyan: '#9AEDFE',
    white: '#d3d7cf',
    brightBlack: '#4D4D4D',
    brightRed: '#e04040',
    brightGreen: '#50FA7B',
    brightYellow: '#F1FA8C',
    brightBlue: '#BD93F9',
    brightMagenta: '#FF79C6',
    brightCyan: '#8BE9FD',
    brightWhite: '#BFBFBb'
  }
}

export const eventTypes = {
  resetFileListTable: 'reset-file-list-table'
}
