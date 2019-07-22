/**
 * app path
 */

const os = require('os')
const platform = os.platform()
const isWin = platform === 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'

const { NODE_ENV } = process.env
const isDev = NODE_ENV === 'development'

module.exports = {
  isDev,
  isWin,
  isMac,
  isLinux,
  defaultLang: 'en_us',
  packInfo: require(isDev ? '../../package.json' : '../package.json')
}
