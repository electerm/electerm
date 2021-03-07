/**
 * ipc main
 */

const {
  ipcMain,
  app,
  powerMonitor,
  globalShortcut
} = require('electron')
const { dbAction } = require('./nedb')
const getInstallSrc = require('./install-src')
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
const { saveUserConfig } = require('./user-config-controller')
const { changeHotkeyReg, initShortCut } = require('./shortcut')
const lastStateManager = require('./last-state')
const {
  packInfo,
  appPath
} = require('../utils/app-props')
const {
  getScreenSize,
  maximize,
  unmaximize
} = require('./window-control')
const { loadFontList } = require('./font-list')
const { checkDbUpgrade, doUpgrade } = require('../upgrade')
// const { listSerialPorts } = require('./serial-port')
const initApp = require('./init-app')
const { encryptAsync, decryptAsync } = require('./enc')
const { initCommandLine } = require('./command-line')

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
    const language = getLang(config, sysLocale)
    config.language = language
    if (!global.et.serverInited) {
      await initServer(config, {
        ...process.env,
        appPath
      }, sysLocale)
      global.et.serverInited = true
    }
    const lang = langMap[language].lang
    const sshConfigItems = await loadSshConfig()
    const installSrc = getInstallSrc()
    global.et.config = config
    const globs = {
      _config: config,
      langs,
      lang,
      installSrc,
      sshConfigItems,
      appPath
    }
    initApp(language, lang, config)
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
    isMaximized
  }
  ipcMain.on('sync-func', (event, { name, args }) => {
    event.returnValue = syncFuncs[name](...args)
  })
  const asyncGlobals = {
    init,
    // listSerialPorts,
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
    changeHotkey: changeHotkeyReg(globalShortcut, global.win),
    initCommandLine
  }
  ipcMain.handle('async', (event, { name, args }) => {
    return asyncGlobals[name](...args)
  })
}

module.exports = initIpc
