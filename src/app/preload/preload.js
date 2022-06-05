/**
 * preload
 */

const fs = require('fs')
const os = require('os')
const { clipboard, shell, ipcRenderer, webFrame } = require('electron')
const lookup = require('../common/lookup')
const { resolve, sep } = require('path')
const contants = require('../common/runtime-constants')
const { transferKeys } = require('../server/transfer')
const _ = require('lodash')
const log = require('electron-log')
const { TrzszFilter } = require('trzsz')

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

  resolve,
  showItemInFolder: (href) => shell.showItemInFolder(href),
  sep,

  ipcOnEvent: (event, cb) => {
    ipcRenderer.on(event, cb)
  },

  ipcOffEvent: (event, cb) => {
    ipcRenderer.removeListener(event, cb)
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
    'openFile',
    'zipFolder',
    'unzipFile'
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

window.newTrzsz = function (writeToTerminal, sendToServer, terminalColumns) {
  // create a trzsz filter
  return new TrzszFilter({
    // write the server output to the terminal
    writeToTerminal: writeToTerminal,
    // send the user input to the server
    sendToServer: sendToServer,
    // choose some files to be sent to the server
    chooseSendFiles: async () => {
      return ipcRenderer.invoke('show-open-dialog-sync', {
        title: 'Choose some files to send',
        message: 'Choose some files to send',
        properties: [
          'openFile',
          'multiSelections',
          'showHiddenFiles',
          'noResolveAliases',
          'treatPackageAsDirectory',
          'dontAddToRecent'
        ]
      })
    },
    // choose a directory to save the received files
    chooseSaveDirectory: async () => {
      const savePaths = await ipcRenderer.invoke('show-open-dialog-sync', {
        title: 'Choose a folder to save file(s)',
        message: 'Choose a folder to save file(s)',
        properties: [
          'openDirectory',
          'showHiddenFiles',
          'createDirectory',
          'noResolveAliases',
          'treatPackageAsDirectory',
          'dontAddToRecent'
        ]
      })
      if (!savePaths || !savePaths.length) {
        return undefined
      }
      return savePaths[0]
    },
    // the terminal columns
    terminalColumns: terminalColumns
  })
}
