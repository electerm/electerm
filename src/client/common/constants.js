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

export const defaultFontFamily = 'mono, courier-new, courier, monospace'
export const defaultFontSize = undefined
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

export const platform = window.getGlobal('os').platform()
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

export const defaultTheme = {
  id: 'default',
  name: 'default',
  themeConfig: {
    foreground: '#b5bd68',
    background: '#000000',
    cursor: '#b5bd68',
    cursorAccent: '#1d1f21',
    selection: 'rgba(255, 255, 255, 0.3)',
    black: '#1d1f21',
    red: '#cc6666',
    green: '#8abeb7',
    yellow: '#EBEB86',
    blue: '#3465a4',
    magenta: '#75507b',
    cyan: '#06989a',
    white: '#d3d7cf',
    brightBlack: '#555753',
    brightRed: '#e04040',
    brightGreen: '#4d9188',
    brightYellow: '#fce94f',
    brightBlue: '#729fcf',
    brightMagenta: '#ad7fa8',
    brightCyan: '#34e2e2',
    brightWhite: '#eeeeec'
  }
}

export const eventTypes = {
  resetFileListTable: 'reset-file-list-table'
}
