
//use bluebird for performance
global.Promise = require('bluebird')

const {app, BrowserWindow, Menu, globalShortcut} = require('electron')
const getConf = require('./config.default')
const runServer = require('./lib/server')
const os = require('os')
const {resolve} = require('path')
const Ftp = require('./lib/sftp')
const fs = require('fs')
const {saveUserConfig} = require('./lib/user-config-controller')
const {init, changeHotkeyReg} = require('./lib/shortcut')
const fsExport = require('./lib/fs')
const ls = require('./lib/ls')
const version = require('./lib/version')
const menu = require('./lib/menu')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let {NODE_ENV} = process.env
const isDev = NODE_ENV === 'development'

async function createWindow () {

  let config = await getConf()

  //start server
  runServer(config)

  if (config.showMenu) Menu.setApplicationMenu(menu)

  const {width, height} = require('electron').screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  win = new BrowserWindow({
    width,
    height,
    fullscreenable: true,
    //fullscreen: true,
    icon: resolve(__dirname, 'static/images/electerm-round-128x128.png')
  })

  win.setAutoHideMenuBar(true)
  require('electron-context-menu')({
    prepend: (params) => [{
      label: 'Rainbow',
      // Only show it when right-clicking images
      visible: params.mediaType === 'image'
    }],
    window: win,
    showInspectElement: isDev
    //shouldShowMenu: (event, params) => !params.isEditable
  })

  Object.assign(global, {
    autoVisitTime: config.timer,
    _config: config,
    Ftp,
    fs: fsExport,
    ls,
    resolve,
    version,
    homeOrtmp: os.homedir() || os.tmpdir(),
    closeApp: () => {
      win.close()
    },
    saveUserConfig,
    changeHotkey: changeHotkeyReg(globalShortcut, win)
  })


  let opts = `http://localhost:${config.port}/index.html`
  if (isDev) {
    let conf = require('../config.default')
    opts = `http://localhost:${conf.devPort}`
  }

  win.loadURL(opts)
  win.maximize()

  // Open the DevTools.
  if(isDev) win.webContents.openDevTools()

  //init hotkey
  init(globalShortcut, win, config)

  // Emitted when the window is closed.
  win.on('close', event => {
    event && event.preventDefault()
    if (typeof win !== undefined && win.hide) {
      win.hide()
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', event => {
  event.preventDefault()
})

app.on('activate', () => {

  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
