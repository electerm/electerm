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

export const termControlHeight = 33
export const maxDragMove = 30
export const minTerminalWidth = 90
export const contextMenuHeight = 28
export const contextMenuWidth = 120
export const contextMenuPaddingTop = 10
export const sftpControlHeight = 28 + 42

export const maxHistory = 50

export const maxSftpHistory = 20

//export const maxTabs = 20

export const tabWidth = 160

export const tabMargin = 3

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
export const topMenuHeight = 43
export const tabsHeight = 46

export const platform = window.getGlobal('os').platform()
export const isWin = platform.startsWith('win')
export const isMac = platform.startsWith('darwin')

export const typeMap = buildConst([
  'remote',
  'local'
])

export const settingMap = buildConst([
  'setting',
  'bookmarks',
  'history',
  'themes'
])

export const transferTypeMap = buildConst([
  'download',
  'upload'
])

export const terminalSplitDirectionMap = buildConst([
  'horizontal',
  'vertical'
])

export const terminalSshConfigType = 'ssh-config'

export const defaultTheme = {
  foreground: '#ffffff',
  background: '#000000',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selection: 'rgba(255, 255, 255, 0.3)',
  black: '#2e3436',
  red: '#cc0000',
  green: '#4e9a06',
  yellow: '#c4a000',
  blue: '#3465a4',
  magenta: '#75507b',
  cyan: '#06989a',
  white: '#d3d7cf',
  brightBlack: '#555753',
  brightRed: '#ef2929',
  brightGreen: '#8ae234',
  brightYellow: '#fce94f',
  brightBlue: '#729fcf',
  brightMagenta: '#ad7fa8',
  brightCyan: '#34e2e2',
  brightWhite: '#eeeeec'
}
