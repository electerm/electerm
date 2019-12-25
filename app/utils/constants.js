/**
 * app path
 */

const os = require('os')
const { resolve } = require('path')

const platform = os.platform()
const isWin = platform === 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'

const { NODE_ENV } = process.env
const isDev = NODE_ENV === 'development'
const iconPath = resolve(
  __dirname,
  (
    isDev
      ? '../../node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
      : '../assets/images/electerm-round-128x128.png'
  )
)
const trayIconPath = resolve(
  __dirname,
  (
    isDev
      ? '../../node_modules/@electerm/electerm-resource/tray-icons/electerm-tray.png'
      : '../assets/images/electerm-tray.png'
  )
)
module.exports = {
  isDev,
  isWin,
  isMac,
  isLinux,
  iconPath,
  trayIconPath,
  minWindowWidth: 590,
  minWindowHeight: 400,
  defaultLang: 'en_us',
  packInfo: require(isDev ? '../../package.json' : '../package.json')
}
