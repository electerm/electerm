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
const { openFileWithEditor } = require('./open-file-with-editor')
const { loadFontList } = require('./font-list')
const { checkDbUpgrade, doUpgrade } = require('../upgrade')
const { listSerialPorts } = require('./serial-port')
const initApp = require('./init-app')
const { encryptAsync, decryptAsync } = require('./enc')
const { safeEncrypt, safeDecrypt } = require('./safe-storage')
const { initCommandLine } = require('./command-line')
const { watchFile, unwatchFile } = require('./watch-file')
const lookup = require('../common/lookup')
const { AIchat, AIchatWithTools, getStreamContent, stopStream } = require('./ai')

// Security: whitelist of safe environment variables for Linux/Mac/Windows
const SAFE_ENV_KEYS = [
  'SHELL', 'TERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'COLORTERM',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'LC_TERMINAL', 'LC_TERMINAL_VERSION',
  'HOME', 'USER', 'LOGNAME', 'USERNAME',
  'PATH', 'PATHEXT',
  'TMPDIR', 'TMP', 'TEMP',
  'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_SESSION_TYPE', 'XDG_RUNTIME_DIR',
  'XDG_DATA_DIRS', 'XDG_CONFIG_DIRS', 'XDG_CURRENT_DESKTOP', 'XDG_SEAT', 'XDG_VTNR',
  'SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'SSH_CLIENT', 'SSH_CONNECTION', 'SSH_TTY',
  'NODE_PATH', 'NODE_ENV', 'NVM_DIR', 'NVM_BIN',
  'NPM_CONFIG_PREFIX', 'NPM_CONFIG_CACHE',
  'GIT_EDITOR', 'GIT_PAGER', 'GIT_TERMINAL_PROMPT',
  'EDITOR', 'VISUAL', 'PAGER',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
  'APPDATA', 'LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'CommonProgramFiles',
  'ComSpec', 'SystemRoot', 'SystemDrive', 'USERPROFILE', 'USERDOMAIN',
  'COMPUTERNAME', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS',
  'Apple_PubSub_Socket_Render',
  'DBUS_SESSION_BUS_ADDRESS', 'DESKTOP_SESSION', 'GNOME_DESKTOP_SESSION_ID', 'KDE_FULL_SESSION',
  'CI', 'DOCKER_HOST', 'CONTAINER'
]

async function initAppServer () {
  const {
    config
  } = await getConfig(globalState.get('serverInited'))
  const {
    langs,
    langMap,
    sysLocale
  } = await loadLocales()
  const language = getLang(config, sysLocale, langs)
  config.language = language
  globalState.set('langMap', langMap)
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
    safeEncrypt: (str) => safeEncrypt(str),
    safeDecrypt: (str) => safeDecrypt(str),
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
    AIchatWithTools,
    getStreamContent,
    stopStream,
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
    openFileWithEditor,
    listWidgets,
    runWidget,
    stopWidget,
    runWidgetFunc,
    registerDeepLink,
    unregisterDeepLink,
    checkProtocolRegistration,
    getPendingDeepLink,
    getEnv: (key) => {
      if (key) {
        return SAFE_ENV_KEYS.includes(key) ? process.env[key] : ''
      }
      return Object.fromEntries(
        SAFE_ENV_KEYS
          .filter(k => process.env[k] !== undefined)
          .map(k => [k, process.env[k]])
      )
    }
  }
  ipcMain.handle('async', (event, { name, args }) => {
    return asyncGlobals[name](...args)
  })
  ipcMain.handle('show-open-dialog-sync', async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showOpenDialogSync(win, ...args)
  })
  ipcMain.handle('show-save-dialog', async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showSaveDialog(win, ...args)
  })
}

exports.initIpc = initIpc
exports.initAppServer = initAppServer
