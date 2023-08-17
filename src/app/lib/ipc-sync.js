/**
 * ipc main
 */

const {
  shell,
  clipboard
} = require('electron')
const log = require('../common/log')
const contants = require('../common/runtime-constants')

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
  const { width, height, x, y } = global.win.getBounds()
  return widthMax === width &&
    heightMax === height &&
    x === sx &&
    y === sy
}

module.exports = {
  debug: (...args) => log.debug(...args),
  log: (...args) => log.log(...args),
  error: (...args) => log.error(...args),
  info: (...args) => log.info(...args),

  readFileSync: (...args) => {
    return require('fs').readFileSync(...args).toString()
  },
  readClipboard: () => {
    return clipboard.readText()
  },
  writeClipboard: str => {
    clipboard.writeText(str)
  },
  resolve: (...args) => require('path').resolve(...args),
  showItemInFolder: (href) => {
    shell.showItemInFolder(href)
  },
  openExternal: (url) => {
    shell.openExternal(url)
  },
  getArgs: () => {
    return global.rawArgs
  },
  getLoadTime: () => {
    return global.loadTime
      ? { loadTime: global.loadTime }
      : { initTime: global.initTime }
  },
  setLoadTime: (loadTime) => {
    global.loadTime = loadTime
  },
  isMaximized,
  isSencondInstance: () => {
    return isTest ? false : global.app.isSencondInstance
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
        'accessAsync',
        'statAsync',
        'lstatAsync',
        'cp',
        'mv',
        'mkdirAsync',
        'touch',
        'chmodAsync',
        'renameAsync',
        'unlinkAsync',
        'rmrf',
        'readdirAsync',
        'readFile',
        'readFileAsBase64',
        'writeFile',
        'openFile',
        'zipFolder',
        'unzipFile'
      ]
    }
  }
}
