/**
 * ipc main
 */

const {
  ipcMain,
  app,
  BrowserWindow,
  dialog,
  powerMonitor,
  globalShortcut,
  shell
} = require('electron')
const { dbAction } = require('./nedb')
const { listItermThemes } = require('./iterm-theme')
const installSrc = require('./install-src')
const { getConfig } = require('./get-config')
const loadSshConfig = require('./ssh-config')
const {
  toCss,
  clearCssCache
} = require('./style')
const initServer = require('./init-server')
const {
  getLang,
  loadLocales
} = require('./locales')
const openNewInstance = require('./open-new-instance')
const { saveUserConfig } = require('./user-config-controller')
const { changeHotkeyReg, initShortCut } = require('./shortcut')
const lastStateManager = require('./last-state')
const {
  packInfo,
  appPath,
  isTest,
  isMac
} = require('../common/app-props')
const {
  getScreenSize,
  maximize,
  unmaximize
} = require('./window-control')
const { loadFontList } = require('./font-list')
const { checkDbUpgrade, doUpgrade } = require('../upgrade')
const { listSerialPorts } = require('./serial-port')
const initApp = require('./init-app')
const { encryptAsync, decryptAsync } = require('./enc')
const { initCommandLine } = require('./command-line')
const { watchFile, unwatchFile } = require('./watch-file')

function initIpc () {
  global.win.on('move', () => {
    global.win.webContents.send('window-move', null)
  })
  powerMonitor.on('resume', () => {
    global.win.webContents.send('power-resume', null)
  })
  async function init () {
    const {
      config
    } = await getConfig(global.et.serverInited)
    const {
      langs,
      langMap,
      sysLocale
    } = await loadLocales()
    const language = getLang(config, sysLocale, langs)
    config.language = language
    if (!global.et.serverInited) {
      const child = await initServer(config, {
        ...process.env,
        appPath
      }, sysLocale)
      child.on('message', (m) => {
        if (m && m.showFileInFolder) {
          if (!isMac) {
            shell.showItemInFolder(m.showFileInFolder)
          }
        }
      })
      global.et.serverInited = true
    }
    global.et.config = config
    const globs = {
      config,
      langs,
      langMap,
      installSrc,
      appPath
    }
    initApp(langMap, config)
    initShortCut(globalShortcut, global.win, config)
    return globs
  }
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
  const syncFuncs = {
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
    }
  }
  ipcMain.on('sync-func', (event, { name, args }) => {
    event.returnValue = syncFuncs[name](...args)
  })
  const asyncGlobals = {
    loadSshConfig,
    openNewInstance,
    init,
    listSerialPorts,
    toCss,
    clearCssCache,
    loadFontList,
    doUpgrade,
    checkDbUpgrade,
    isMaximized,
    getExitStatus: () => global.et.exitStatus,
    setExitStatus: (status) => {
      global.et.exitStatus = status
    },
    encryptAsync,
    decryptAsync,
    dbAction,
    getScreenSize,
    closeApp: () => {
      global.win && global.win.close()
    },
    restart: () => {
      global.win.close()
      app.relaunch()
    },
    minimize: () => {
      global.win.minimize()
    },
    listItermThemes,
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
      global.win && global.win.setTitle(packInfo.name + ' - ' + title)
    },
    changeHotkey: changeHotkeyReg(globalShortcut, global.win),
    initCommandLine,
    watchFile,
    unwatchFile
  }
  ipcMain.handle('async', (event, { name, args }) => {
    return asyncGlobals[name](...args)
  })
  ipcMain.handle('show-open-dialog-sync', async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showOpenDialogSync(win, ...args)
  })
}

module.exports = initIpc
