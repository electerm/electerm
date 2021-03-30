/**
 * preload
 */

const fs = require('fs')
const os = require('os')
const { clipboard, shell, ipcRenderer, webFrame } = require('electron')
const vali = require('path-validation')
const lookup = require('../common/lookup')
const { resolve, sep } = require('path')
const contants = require('../utils/constants')
const { transferKeys } = require('../server/transfer')
const _ = require('lodash')
const log = require('electron-log')

log.transports.console.format = '{h}:{i}:{s} {level} › {text}'

window.log = log

const pre = {
  readFileSync: (path) => {
    return fs.readFileSync(path)
  },

  readClipboard: () => {
    return clipboard.readText()
  },

  writeClipboard: str => {
    return clipboard.writeText(str)
  },

  isAbsolutePath: (path, sep) => {
    return vali.isAbsolutePath(path, sep)
  },

  resolve,
  showItemInFolder: (href) => shell.showItemInFolder(href),
  sep,

  ipcOnEvent: (event, cb) => {
    ipcRenderer.on(event, cb)
  },
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: (nl) => webFrame.setZoomFactor(nl),
  lookup,
  openExternal: (url) => shell.openExternal(url),
  ...contants,
  env: process.env,
  versions: process.versions,
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
    'openFile'
  ],
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
  getGlobalSync: (name, ...args) => {
    return ipcRenderer.sendSync('sync', {
      name,
      args
    })
  },
  runGlobalAsync: (name, ...args) => {
    return ipcRenderer.invoke('async', {
      name,
      args
    })
  },
  runSync: (name, ...args) => {
    return ipcRenderer.sendSync('sync-func', {
      name,
      args
    })
  }
}

window.pre = pre
