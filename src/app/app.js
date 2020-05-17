
// use bluebird for performance
global.Promise = require('bluebird')

const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  globalShortcut,
  shell,
  session
} = require('electron')
const { dbAction } = require('./lib/nedb')
const { getAllConfig } = require('./lib/get-config')
const initServer = require('./lib/init-server')
const sshConfigItems = require('./lib/ssh-config')
const lookup = require('./utils/lookup')
const os = require('os')
const { resolve } = require('path')
const { transferKeys } = require('./server/transfer')
const { saveUserConfig } = require('./lib/user-config-controller')
const { init, changeHotkeyReg } = require('./lib/shortcut')
const { fsExport, fsFunctions } = require('./lib/fs')
const menu = require('./lib/menu')
const log = require('./utils/log')
const lastStateManager = require('./lib/last-state')
const installSrc = require('./lib/install-src')
const {
  isDev, packInfo, iconPath,
  minWindowWidth, minWindowHeight,
  appPath
} = require('./utils/app-props')
const { getWindowSize, getScreenSize } = require('./utils/window-size')
const {
  prefix
} = require('./lib/locales')
const { loadFontList } = require('./lib/font-list')
const { encrypt, decrypt } = require('./lib/enc')
const a = prefix('app')
const { onClose, getExitStatus } = require('./lib/on-close')
const { checkDbUpgrade, doUpgrade } = require('./upgrade')
const showItemInFolder = require('./lib/show-item-in-folder')
const openItem = require('./lib/open-item')
require('./lib/tray')

global.et = {
  timer: null,
  timer1: null
}
global.win = null
global.childPid = null

log.debug('App starting...')

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals')
  app.commandLine.appendSwitch('disable-gpu')
}

async function createWindow () {
  session.defaultSession.webRequest.onBeforeRequest((details, done) => {
    const redirectURL = details.url.replace(/^devtools:\/\/devtools\/remote\/serve_file\/@[0-9a-f]{40}/, 'https://chrome-devtools-frontend.appspot.com/serve_file/@675968a8c657a3bd9c1c2c20c5d2935577bbc5e6')
    if (redirectURL !== details.url) {
      done({ redirectURL })
    } else {
      done({})
    }
  })
  const { config, localeRef } = await initServer({
    ...process.env,
    appPath
  })
  const { lang, langs } = localeRef
  if (config.showMenu) {
    Menu.setApplicationMenu(menu)
  }

  const { width, height } = await getWindowSize()

  // Create the browser window.
  global.win = new BrowserWindow({
    width,
    height,
    fullscreenable: true,
    // fullscreen: true,
    title: packInfo.name,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true
    },
    titleBarStyle: 'customButtonsOnHover',
    icon: iconPath
  })

  // win.setAutoHideMenuBar(true)

  // handle autohide flag
  if (process.argv.includes('--autohide')) {
    global.et.timer1 = setTimeout(() => global.win.hide(), 500)
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${a('isRunning')}, ${a('press')} ${config.hotkey} ${a('toShow')}`
      })
      notice.show()
    }
  }

  global.et.exitStatus = process.argv.includes('--no-session-restore')
    ? 'ok'
    : await getExitStatus()

  Object.assign(global.et, {
    loadFontList,
    _config: config,
    getAllConfig,
    installSrc,
    transferKeys,
    upgradeKeys: transferKeys,
    fs: fsExport,
    showItemInFolder,
    openItem,
    doUpgrade,
    checkDbUpgrade,
    getExitStatus: () => global.et.exitStatus,
    setExitStatus: (status) => {
      global.et.exitStatus = status
    },
    popup: (options) => {
      Menu.getApplicationMenu().popup(options)
    },
    dbAction,
    appPath,
    getScreenSize,
    versions: process.versions,
    sshConfigItems,
    env: process.env,
    fsFunctions,
    encrypt,
    decrypt,
    openExternal: shell.openExternal,
    homeOrtmp: os.homedir() || os.tmpdir(),
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
    maximize: () => {
      global.win.maximize()
    },
    unmaximize: () => {
      global.win.unmaximize()
    },
    isMaximized: () => {
      const { width: widthMax, height: heightMax } = getScreenSize()
      const { width, height } = global.win.getBounds()
      return widthMax === width && heightMax === height
    },
    openDevTools: () => {
      global.win.webContents.openDevTools()
    },
    lookup,
    lang,
    langs,
    packInfo,
    lastStateManager,
    os,
    saveUserConfig,
    setTitle: (title) => {
      global.win.setTitle(packInfo.name + ' - ' + title)
    },
    changeHotkey: changeHotkeyReg(globalShortcut, global.win)
  })

  global.et.timer = setTimeout(() => {
    dbAction('data', 'update', {
      _id: 'exitStatus'
    }, {
      value: 'unknown'
    }, {
      upsert: true
    })
  }, 100)

  let opts = require('url').format({
    protocol: 'file',
    slashes: true,
    pathname: resolve(__dirname, 'assets', 'index.html')
  })

  if (isDev) {
    const { devPort = 5570 } = process.env
    opts = `http://localhost:${devPort}`
  }

  global.win.loadURL(opts)
  // win.maximize()

  // Open the DevTools.
  if (isDev) {
    global.win.webContents.once('dom-ready', () => {
      global.win.webContents.openDevTools()
    })
  }

  // init hotkey
  init(globalShortcut, global.win, config)

  global.win.on('unmaximize', () => {
    const { width, height } = global.win.getBounds()
    if (width < minWindowWidth || height < minWindowHeight) {
      global.win.setBounds({
        x: 0,
        y: 0,
        width: minWindowWidth,
        height: minWindowHeight
      })
      global.win.center()
    }
  })
  // Emitted when the window is closed.
  global.win.on('close', onClose)
  global.win.on('focus', () => {
    global.win.webContents.send('focused', null)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (global.win === null) {
    createWindow()
  }
})

global.app = app
