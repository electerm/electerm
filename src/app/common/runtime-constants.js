/**
 * run time contants
 */

const os = require('os')
const { existsSync } = require('fs')
const { resolve } = require('path')

const platform = os.platform()
const arch = os.arch()
const isWin = platform === 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'
const isArm = arch.includes('arm')

const { NODE_ENV, NODE_TEST } = process.env
const isDev = NODE_ENV === 'development'
const resolveFirstExisting = (...paths) => {
  return paths.find(path => existsSync(path)) || paths[0]
}
const srcRoot = resolve(__dirname, '../../..')
const appRoot = resolve(__dirname, '..')
const iconPath = resolveFirstExisting(
  resolve(srcRoot, 'node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'),
  resolve(appRoot, 'assets/images/electerm-round-128x128.png')
)
const trayIconPath = resolveFirstExisting(
  resolve(srcRoot, 'node_modules/@electerm/electerm-resource/tray-icons/electerm-tray.png'),
  resolve(appRoot, 'assets/images/electerm-tray.png')
)
const extIconPath = existsSync(
  resolve(srcRoot, 'node_modules/electerm-icons/icons')
)
  ? '/node_modules/electerm-icons/icons/'
  : 'icons/'
const packInfoPath = resolveFirstExisting(
  resolve(srcRoot, 'package.json'),
  resolve(appRoot, 'package.json')
)

const defaultUserName = require('./default-user-name')

module.exports = {
  isTest: !!NODE_TEST,
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
  tempDir: require('os').tmpdir(),
  homeOrTmp: os.homedir() || os.tmpdir(),
  packInfo: require(packInfoPath)
}
