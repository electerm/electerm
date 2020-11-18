
// use bluebird for performance
global.Promise = require('bluebird')
require('v8-compile-cache')
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  globalShortcut,
  session
} = require('electron')
const { dbAction } = require('./lib/nedb')
const initServer = require('./lib/init-server')
const { resolve } = require('path')
const { init } = require('./lib/shortcut')
const menu = require('./lib/menu')
const log = require('./utils/log')
const {
  isDev, packInfo, iconPath,
  minWindowWidth, minWindowHeight,
  appPath
} = require('./utils/app-props')
const {
  getWindowSize
} = require('./lib/window-control')
const {
  prefix
} = require('./lib/locales')
const a = prefix('app')
const { onClose, getExitStatus } = require('./lib/on-close')
const initIpc = require('./lib/ipc')
require('./lib/tray')

app.setName(packInfo.name)
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
    backgroundColor: '#ff333333',
    webPreferences: {
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: resolve(__dirname, './preload/preload.js')
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

  initIpc(config, lang, langs)

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
    opts = `http://127.0.0.1:${devPort}`
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
