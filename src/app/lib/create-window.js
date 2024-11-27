const {
  BrowserWindow
} = require('electron')
const { resolve } = require('path')
const {
  isDev, packInfo, iconPath, isMac,
  minWindowWidth, minWindowHeight
} = require('../common/runtime-constants')
const defaults = require('../common/default-setting')
const {
  getWindowSize,
  setWindowPos
} = require('./window-control')
const { onClose } = require('./on-close')
const { initIpc, initAppServer } = require('./ipc')
const { getDbConfig } = require('./get-config')
const { disableShortCuts } = require('./key-bind')
const _ = require('lodash')
const getPort = require('./get-port')
const globalState = require('./glob-state')

exports.createWindow = async function () {
  const userConfig = await getDbConfig() || {}
  globalState.set('closeAction', 'closeApp')
  globalState.set('requireAuth', !!userConfig.hashedPassword)
  const { width, height, x, y } = await getWindowSize()
  const { useSystemTitleBar = defaults.useSystemTitleBar } = userConfig
  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    fullscreenable: true,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    title: packInfo.name,
    frame: useSystemTitleBar,
    transparent: !useSystemTitleBar,
    backgroundColor: '#33333300',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: resolve(__dirname, '../preload/preload.js'),
      webviewTag: true
    },
    titleBarStyle: useSystemTitleBar ? 'default' : 'hidden',
    icon: iconPath
  })
  // hides the traffic lights
  if (isMac) {
    win.setWindowButtonVisibility(true)
  }

  globalState.set('win', win)

  await initAppServer()
  initIpc()
  const port = isDev
    ? process.env.devPort || 5570
    : await getPort()
  const opts = `http://127.0.0.1:${port}/index.html?v=${packInfo.version}`

  win.loadURL(opts)
  win.webContents.once('dom-ready', () => {
    if (isDev) {
      win.webContents.openDevTools()
    }
    win.on('unmaximize', () => {
      const { width, height } = win.getBounds()
      if (width < minWindowWidth || height < minWindowHeight) {
        win.setBounds({
          x: 0,
          y: 0,
          width: minWindowWidth,
          height: minWindowHeight
        })
        win.center()
      }
    })
    win.on('move', _.debounce(() => {
      const { x, y } = win.getBounds()
      setWindowPos({ x, y })
    }, 100))

    win.on('focus', () => {
      win.webContents.send('focused', null)
    })
    win.on('blur', () => {
      win.webContents.send('blur', null)
    })
    disableShortCuts(win)
  })
  win.on('close', onClose)
}
