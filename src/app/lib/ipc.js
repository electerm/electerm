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
const ipcSyncFuncs = require('./ipc-sync')
const { dbAction } = require('./nedb')
const { listItermThemes } = require('./iterm-theme')
const installSrc = require('./install-src')
const { getConfig } = require('./get-config')
const loadSshConfig = require('./ssh-config')
const {
  setPassword,
  checkPassword
} = require('./auth')
const {
  toCss
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
  isMac,
  exePath,
  isPortable,
  sshKeysPath
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
const lookup = require('../common/lookup')

function initIpc () {
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
        appPath,
        sshKeysPath
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
      appPath,
      exePath,
      isPortable
    }
    initApp(langMap, config)
    initShortCut(globalShortcut, global.win, config)
    return globs
  }

  ipcMain.on('sync-func', (event, { name, args }) => {
    event.returnValue = ipcSyncFuncs[name](...args)
  })
  const asyncGlobals = {
    setPassword,
    checkPassword,
    lookup,
    loadSshConfig,
    openNewInstance,
    init,
    listSerialPorts,
    toCss,
    loadFontList,
    doUpgrade,
    checkDbUpgrade,
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
