/**
 * ipc main
 */

const {
  ipcMain,
  app,
  globalShortcut
} = require('electron')
const { dbAction } = require('../lib/nedb')
const { getAllConfig } = require('../lib/get-config')
const sshConfigItems = require('../lib/ssh-config')
const {
  toCss,
  clearCssCache
} = require('../lib/style')
const { saveUserConfig } = require('../lib/user-config-controller')
const { changeHotkeyReg } = require('../lib/shortcut')
const lastStateManager = require('../lib/last-state')
const {
  packInfo,
  appPath
} = require('../utils/app-props')
const {
  getScreenSize,
  maximize,
  unmaximize
} = require('../lib/window-control')
const { loadFontList } = require('../lib/font-list')
const { checkDbUpgrade, doUpgrade } = require('../upgrade')

function initIpc (config, lang, langs) {
  const syncGlobals = {
    _config: config,
    appPath,
    sshConfigItems,
    lang,
    langs
  }
  const isMaximized = () => {
    const { width: widthMax, height: heightMax } = getScreenSize()
    const { width, height } = global.win.getBounds()
    return widthMax === width && heightMax === height
  }
  ipcMain.on('sync', (event, { name, args }) => {
    event.returnValue = syncGlobals[name]
  })
  const syncFuncs = {
    isMaximized
  }
  ipcMain.on('sync-func', (event, { name, args }) => {
    event.returnValue = syncFuncs[name](...args)
  })
  const asyncGlobals = {
    toCss,
    clearCssCache,
    loadFontList,
    getAllConfig,
    doUpgrade,
    checkDbUpgrade,
    isMaximized,
    getExitStatus: () => global.et.exitStatus,
    setExitStatus: (status) => {
      global.et.exitStatus = status
    },
    dbAction,
    getScreenSize,
    closeApp: () => {
      global.win.close()
    },
    restart: () => {
      global.win.close()
      app.relaunch()
    },
    minimize: () => {
      global.win.minimize()
    },
    maximize,
    unmaximize,
    openDevTools: () => {
      global.win.webContents.openDevTools()
    },
    lastStateManager,
    setWindowSize: (update) => {
      lastStateManager.set('windowSize', update)
    },
    saveUserConfig,
    setTitle: (title) => {
      global.win.setTitle(packInfo.name + ' - ' + title)
    },
    changeHotkey: changeHotkeyReg(globalShortcut, global.win)
  }
  ipcMain.handle('async', (event, { name, args }) => {
    return asyncGlobals[name](...args)
  })
}

module.exports = initIpc
