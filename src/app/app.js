
require('v8-compile-cache')
const {
  app,
  BrowserWindow
} = require('electron')
const { resolve } = require('path')
const log = require('./utils/log')
const {
  isDev, packInfo, iconPath,
  minWindowWidth, minWindowHeight
} = require('./utils/constants')
const {
  getWindowSize
} = require('./lib/window-control')
const { onClose } = require('./lib/on-close')
const initIpc = require('./lib/ipc')
const { getDbConfig } = require('./lib/get-config')

app.setName(packInfo.name)
global.et = {
  timer: null,
  timer1: null
}
global.win = null
global.childPid = null

log.debug('electerm start')

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals')
  app.commandLine.appendSwitch('disable-gpu')
}

async function createWindow () {
  const userConfig = await getDbConfig() || {}
  const { width, height } = await getWindowSize()
  const { useSystemTitleBar } = userConfig
  // Create the browser window.
  console.log('useSystemTitleBar', useSystemTitleBar)
  const isTest = process.env.NODE_TEST === 'yes'

  global.win = new BrowserWindow({
    width,
    height,
    fullscreenable: true,
    // fullscreen: true,
    title: packInfo.name,
    frame: useSystemTitleBar,
    transparent: !useSystemTitleBar,
    backgroundColor: '#333333FF',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: isTest,
      enableRemoteModule: isTest,
      preload: resolve(__dirname, './preload/preload.js')
    },
    titleBarStyle: useSystemTitleBar ? 'default' : 'customButtonsOnHover',
    icon: iconPath
  })

  initIpc()

  let opts

  if (isDev) {
    const { devPort = 5570 } = process.env
    opts = `http://127.0.0.1:${devPort}`
  } else {
    opts = require('url').format({
      protocol: 'file',
      slashes: true,
      pathname: resolve(__dirname, 'assets', 'index.html')
    })
  }

  global.win.loadURL(opts)

  // if (isDev) {
  //   global.win.webContents.once('dom-ready', () => {
  //     global.win.webContents.openDevTools()
  //   })
  // }

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
