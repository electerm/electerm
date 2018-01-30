/**
 * constants
 */

export const contextMenuHeight = 28
export const contextMenuWidth = 120
export const contextMenuPaddingTop = 10
export const sftpControlHeight = 42 + 42

export const maxHistory = 50

//export const maxTabs = 20

export const tabWidth = 160

export const tabMargin = 3

export const statusMap = {
  default: 'default',
  success: 'success',
  error: 'error',
  processing: 'processing',
  warning: 'warning'
}

export const authTypeMap = {
  password: 'password',
  privateKey: 'privateKey'
}

export const topMenuHeight = 39
export const tabsHeight = 46
export const sshTabHeight = 36

export const platform = window.getGlobal('os').platform()
export const isWin = platform.startsWith('win')
export const isMac = platform.startsWith('darwin')

export const typeMap = {
  remote: 'remote',
  local: 'local'
}

export const settingMap = {
  setting: 'setting',
  bookmarks: 'bookmarks',
  history: 'history'
}

export const transferTypeMap = {
  download: 'download',
  upload: 'upload'
}
