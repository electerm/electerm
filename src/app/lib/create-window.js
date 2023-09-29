
const {
  BrowserWindow
} = require('electron')
const { resolve } = require('path')
const {
  isDev, packInfo, iconPath,
  minWindowWidth, minWindowHeight
} = require('../common/runtime-constants')
const {
  getWindowSize
} = require('./window-control')
const { onClose } = require('./on-close')
const initIpc = require('./ipc')
const { getDbConfig } = require('./get-config')
const fileServer = require('./file-server')
const { disableShortCuts } = require('./key-bind')

exports.createWindow = async function () {
  const userConfig = await getDbConfig() || {}
  const { width, height } = await getWindowSize()
  const { useSystemTitleBar } = userConfig

  const win = new BrowserWindow({
    width,
    height,
    fullscreenable: true,
    // fullscreen: true,
    title: packInfo.name,
    frame: useSystemTitleBar,
    transparent: !useSystemTitleBar,
    backgroundColor: '#33333300',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: resolve(__dirname, '../preload/preload.js')
    },
    titleBarStyle: useSystemTitleBar ? 'default' : 'customButtonsOnHover',
    icon: iconPath
  })

  global.win = win

  initIpc()

  const defaultPort = isDev ? 5570 : 30974
  const { devPort = defaultPort } = process.env
  const opts = `http://127.0.0.1:${devPort}/index.html?v=${packInfo.version}`
  if (!isDev && !global.isSencondInstance) {
    await fileServer(devPort)
  }
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
    // Emitted when the window is closed.

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
