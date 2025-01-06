/**
 * ipc main
 */

const {
  shell,
  clipboard
} = require('electron')
const log = require('../common/log')
const contants = require('../common/runtime-constants')
const windowMove = require('./window-drag-move.js')
const globalState = require('./glob-state')
const { transferKeys } = require('../server/transfer')
const os = require('os')
const {
  isTest
} = require('../common/app-props')
const {
  getScreenSize
} = require('./window-control')
const _ = require('lodash')

const isMaximized = () => {
  const {
    width: widthMax,
    height: heightMax,
    x: sx,
    y: sy
  } = getScreenSize()
  const win = globalState.get('win')
  const { width, height, x, y } = win.getBounds()
  return widthMax === width &&
    heightMax === height &&
    x === sx &&
    y === sy
}

module.exports = {
  windowMove,
  debug: (...args) => log.debug(...args),
  log: (...args) => log.log(...args),
  error: (...args) => log.error(...args),
  info: (...args) => log.info(...args),
  getFsContants: () => {
    return require('fs').constants
  },
  readClipboard: () => {
    return clipboard.readText()
  },
  writeClipboard: str => {
    clipboard.writeText(str)
  },
  resolve: (...args) => require('path').resolve(...args),
  join: (...args) => require('path').join(...args),
  basename: (...args) => require('path').basename(...args),
  showItemInFolder: (href) => {
    shell.showItemInFolder(href)
  },
  openExternal: (url) => {
    shell.openExternal(url)
  },
  getArgs: () => {
    return globalState.get('rawArgs')
  },
  shouldAuth: () => globalState.get('requireAuth'),
  getLoadTime: () => {
    return globalState.get('loadTime')
      ? { loadTime: globalState.get('loadTime') }
      : { initTime: globalState.get('initTime') }
  },
  setLoadTime: (loadTime) => {
    globalState.set('loadTime', loadTime)
  },
  getInitTime: () => {
    return globalState.get('initTime')
  },
  isMaximized,
  isSecondInstance: () => {
    return isTest ? false : globalState.get('isSecondInstance')
  },
  osInfo: () => {
    return Object.keys(os).map((k, i) => {
      const vf = os[k]
      if (!_.isFunction(vf)) {
        return null
      }
      let v
      try {
        v = vf()
      } catch (e) {
        return null
      }
      if (!v) {
        return null
      }
      v = JSON.stringify(v, null, 2)
      return { k, v }
    }).filter(d => d)
  },
  getConstants: () => {
    return {
      sep: require('path').sep,
      ...contants,
      env: JSON.stringify(process.env),
      versions: JSON.stringify(process.versions),
      transferKeys,
      fsFunctions: [
        'run',
        'runWinCmd',
        'access',
        'statAsync',
        'lstatAsync',
        'cp',
        'mv',
        'mkdir',
        'touch',
        'chmod',
        'rename',
        'unlink',
        'rmrf',
        'readdirAsync',
        'readFile',
        'readFileAsBase64',
        'writeFile',
        'openFile',
        'zipFolder',
        'unzipFile',
        'readCustom',
        'exists',
        'readdir',
        'mkdir',
        'realpath',
        'statCustom',
        'openCustom',
        'closeCustom',
        'writeCustom',
        'getFolderSize'
      ]
    }
  }
}
