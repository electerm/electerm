
//use bluebird for performance
global.Promise = require('bluebird')

const {
  app, BrowserWindow, Menu,
  globalShortcut, shell
} = require('electron')
const {fork} = require('child_process')
const _ = require('lodash')
const getConf = require('./config.default')
const sshConfigItems = require('./lib/ssh-config')
const os = require('os')
const {resolve} = require('path')
const {instSftpKeys} = require('./lib/sftp')
const {transferKeys} = require('./lib/transfer')
const {saveUserConfig, userConfig} = require('./lib/user-config-controller')
const {init, changeHotkeyReg} = require('./lib/shortcut')
const {fsExport, fsFunctions, syncFsFunctions} = require('./lib/fs')
const ls = require('./lib/ls')
const version = require('./lib/version')
const menu = require('./lib/menu')
const {setWin} = require('./lib/win')
const log = require('electron-log')
const {testConnection} = require('./lib/terminal')
const {saveLangConfig, lang, langs} = require('./lib/locales')
const rp = require('phin').promisified

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let timer
let childPid
let {NODE_ENV} = process.env
const isDev = NODE_ENV === 'development'
const packInfo = require(isDev ? '../package.json' : './package.json')
const iconPath = resolve(
  __dirname,
  (isDev ? '../' : '') +
  'node_modules/electerm-resource/res/imgs/electerm-round-128x128.png'
)

function onClose() {
  clearTimeout(timer)
  win = null
  process.kill(childPid)
  setWin(win)
  process.exit(0)
}

async function waitUntilServerStart(url) {
  let serverStarted = false
  while (!serverStarted) {
    await rp({
      url,
      timeout: 100
    })
      .then(() => {
        serverStarted = true
      })
      .catch(() => null)
  }
}

log.info('App starting...')

async function createWindow () {

  let config = await getConf()

  //start server
  let child = fork(resolve(__dirname, './lib/server.js'), {
    env: Object.assign(
      {},
      process.env,
      _.pick(config, ['port', 'host'])
    ),
    cwd: process.cwd()
  }, (error, stdout, stderr) => {
    if (error || stderr) {
      throw error || stderr
    }
    log.info(stdout)
  })

  childPid = child.pid

  if (config.showMenu) Menu.setApplicationMenu(menu)

  const {width, height} = require('electron').screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  win = new BrowserWindow({
    width,
    height,
    fullscreenable: true,
    //fullscreen: true,
    icon: iconPath
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

  global.et = {}
  Object.assign(global.et, {
    autoVisitTime: config.timer,
    _config: config,
    instSftpKeys,
    transferKeys,
    fs: fsExport,
    ls,
    resolve,
    version,
    sshConfigItems,
    testConnection,
    env: process.env,
    fsFunctions,
    syncFsFunctions,
    openExternal: shell.openExternal,
    homeOrtmp: os.homedir() || os.tmpdir(),
    closeApp: () => {
      win.close()
    },
    restart: () => {
      win.close()
      app.relaunch()
    },
    lang,
    langs,
    packInfo,
    os,
    saveUserConfig,
    changeHotkey: changeHotkeyReg(globalShortcut, win)
  })

  timer = setTimeout(() => {
    saveLangConfig(saveUserConfig, userConfig)
  }, 100)

  let opts = `http://localhost:${config.port}/index.html`
  let childServerUrl = opts + ''
  if (isDev) {
    let conf = require('../config.default')
    opts = `http://localhost:${conf.devPort}`
  }

  await waitUntilServerStart(childServerUrl)

  win.loadURL(opts)
  win.maximize()

  // Open the DevTools.
  if(isDev) win.webContents.openDevTools()

  //init hotkey
  init(globalShortcut, win, config)

  // Emitted when the window is closed.
  win.on('close', onClose)

  setWin(win)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', onClose)

app.on('activate', () => {

  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
