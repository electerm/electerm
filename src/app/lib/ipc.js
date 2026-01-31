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
const globalState = require('./glob-state')
const ipcSyncFuncs = require('./ipc-sync')
const { dbAction } = require('./db')
const { listItermThemes } = require('./iterm-theme')
const installSrc = require('./install-src')
const { getConfig } = require('./get-config')
const loadSshConfig = require('./ssh-config')
const {
  listWidgets,
  runWidget,
  stopWidget,
  runWidgetFunc
} = require('../widgets/load-widget')
const {
  checkMigrate,
  migrate
} = require('../migrate/migrate-1-to-2')
const {
  setPassword,
  checkPassword
} = require('./auth')
const initServer = require('./init-server')
const {
  getLang,
  loadLocales
} = require('./locales')
const { saveUserConfig } = require('./user-config-controller')
const { changeHotkeyReg, initShortCut } = require('./shortcut')
const lastStateManager = require('./last-state')
const windowMove = require('./window-drag-move')
const {
  registerDeepLink,
  unregisterDeepLink,
  checkProtocolRegistration,
  getPendingDeepLink
} = require('./deep-link')
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
const { AIchat, getStreamContent } = require('./ai')

async function initAppServer () {
  const {
    config
  } = await getConfig(globalState.get('serverInited'))
  const {
    langs,
    sysLocale
  } = await loadLocales()
  const language = getLang(config, sysLocale, langs)
  config.language = language
  if (!globalState.get('serverInited')) {
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
    globalState.set('serverInited', true)
  }
  globalState.set('config', config)
}

function initIpc () {
  powerMonitor.on('resume', () => {
    globalState.get('win').webContents.send('power-resume', null)
  })
  async function init () {
    const {
      langs,
      langMap
    } = await loadLocales()
    const config = globalState.get('config')
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
    initShortCut(globalShortcut, globalState.get('win'), config)
    return globs
  }

  ipcMain.on('sync-func', (event, { name, args }) => {
    event.returnValue = ipcSyncFuncs[name](...args)
  })
  const asyncGlobals = {
    confirmExit: () => {
      globalState.set('confirmExit', true)
    },
    windowMove,
    setPassword,
    checkPassword,
    lookup,
    loadSshConfig,
    init,
    listSerialPorts,
    loadFontList,
    doUpgrade,
    checkDbUpgrade,
    checkMigrate,
    migrate,
    getExitStatus: () => globalState.get('exitStatus'),
    setExitStatus: (status) => {
      globalState.set('exitStatus', status)
    },
    encryptAsync,
    decryptAsync,
    dbAction,
    getScreenSize,
    closeApp: (closeAction = '') => {
      globalState.set('closeAction', closeAction)
      const win = globalState.get('win')
      win && win.close()
    },
    exit: () => {
      const win = globalState.get('win')
      win && win.close()
    },
    restart: (closeAction = '') => {
      globalState.set('closeAction', '')
      globalState.get('win').close()
      app.relaunch()
    },
    setCloseAction: (closeAction = '') => {
      globalState.set('closeAction', closeAction)
    },
    minimize: () => {
      globalState.get('win').minimize()
    },
    listItermThemes,
    maximize,
    unmaximize,
    openDevTools: () => {
      globalState.get('win').webContents.openDevTools()
    },
    setWindowSize: (update) => {
      lastStateManager.set('windowSize', update)
    },
    saveUserConfig,
    AIchat,
    getStreamContent,
    setTitle: (title) => {
      const win = globalState.get('win')
      win && win.setTitle(packInfo.name + ' - ' + title)
    },
    setBackgroundColor: (color = '#33333300') => {
      const win = globalState.get('win')
      win && win.setBackgroundColor(color)
    },
    changeHotkey: changeHotkeyReg(globalShortcut, globalState.get('win')),
    initCommandLine,
    watchFile,
    unwatchFile,
    listWidgets,
    runWidget,
    stopWidget,
    runWidgetFunc,
    registerDeepLink,
    unregisterDeepLink,
    checkProtocolRegistration,
    getPendingDeepLink
  }
  ipcMain.handle('async', (event, { name, args }) => {
    return asyncGlobals[name](...args)
  })
  ipcMain.handle('show-open-dialog-sync', async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showOpenDialogSync(win, ...args)
  })
}

exports.initIpc = initIpc
exports.initAppServer = initAppServer
