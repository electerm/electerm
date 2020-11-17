/**
 * preload
 */

const fs = require('fs')
const { clipboard, shell, ipcRenderer, remote, webFrame } = require('electron')
const vali = require('path-validation')
const { resolve, sep } = require('path')
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
  setZoomFactor: (nl) => webFrame.setZoomFactor(nl)
}

window.pre = pre
