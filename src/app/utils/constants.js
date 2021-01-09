/**
 * app path
 */

const os = require('os')
const { resolve } = require('path')

const platform = os.platform()
const arch = os.arch()
const isWin = platform === 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'
const isArm = arch.includes('arm')

const { NODE_ENV } = process.env
const isDev = NODE_ENV === 'development'
const iconPath = resolve(
  __dirname,
  (
    isDev
      ? '../../../node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
      : '../assets/images/electerm-round-128x128.png'
  )
)
const trayIconPath = resolve(
  __dirname,
  (
    isDev
      ? '../../../node_modules/@electerm/electerm-resource/tray-icons/electerm-tray.png'
      : '../assets/images/electerm-tray.png'
  )
)
const extIconPath = isDev
  ? '/node_modules/vscode-icons/icons/'
  : 'icons/'

const defaultUserName = require('../common/default-user-name')

module.exports = {
  isDev,
  isWin,
  isMac,
  isArm,
  isLinux,
  iconPath,
  trayIconPath,
  extIconPath,
  defaultUserName,
  minWindowWidth: 590,
  minWindowHeight: 400,
  defaultLang: 'en_us',
  homeOrtmp: os.homedir() || os.tmpdir(),
  packInfo: require(isDev ? '../../../package.json' : '../package.json')
}
