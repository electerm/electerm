/**
 * preload
 */

const fs = require('fs')
const { clipboard, shell, ipcRenderer, remote, webFrame } = require('electron')
const vali = require('path-validation')
const lookup = require('../common/lookup')
const { resolve, sep } = require('path')
const contants = require('../utils/constants')
const { transferKeys } = require('../server/transfer')
const installSrc = require('../lib/install-src')

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
  getGlobal: (name) => remote.getGlobal('et')[name],
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: (nl) => webFrame.setZoomFactor(nl),
  lookup,
  openExternal: (url) => shell.openExternal(url),
  ...contants,
  env: process.env,
  versions: process.versions,
  transferKeys,
  installSrc,
  fsFunctions: [
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
  ]

}

window.pre = pre
