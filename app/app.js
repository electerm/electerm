
//use bluebird for performance
global.Promise = require('bluebird')

const {app, BrowserWindow, Menu, globalShortcut} = require('electron')
const getConf = require('./config.default')
const runServer = require('./server')
const os = require('os')
const {resolve} = require('path')
const Ftp = require('ssh2-sftp-client')
const fs = require('fs')

let version = +new Date()
try {
  version = require('fs').readFileSync('./version').toString()
} catch(e) {
  console.log('no version file created')
}

Ftp.prototype.getFile = function(remotePath, localPath, useCompression, encoding) {
  let options = this.getOptions(useCompression, encoding)
  return new Promise((resolve, reject) => {
    let sftp = this.sftp
    let streamRead = sftp.createReadStream(remotePath, options)
    let streamWrite = fs.createWriteStream(localPath, options)
    streamRead.on('data', data => {
      streamWrite.write(data)
    })
    streamRead.on('close', () => {
      streamWrite.close()
      resolve()
    })
    streamRead.on('error', err => {
      reject(err)
    })
  })
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

const template = [
  {
    label: 'View',
    submenu: [
      {role: 'reload'},
      {role: 'toggledevtools'},
      {type: 'separator'},
      {role: 'resetzoom'},
      {role: 'zoomin'},
      {role: 'zoomout'},
      {type: 'separator'},
      {role: 'togglefullscreen'}
    ]
  },
  {
    role: 'window',
    submenu: [
      {role: 'minimize'},
      {role: 'close'}
    ]
  }
]
const menu = Menu.buildFromTemplate(template)
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
    icon: './static/images/electerm-round.png'
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

  global.autoVisitTime = config.timer
  global._config = config
  global.Ftp = Ftp
  global.fs = Promise.promisifyAll(fs)
  global.resolve = resolve
  global.version = version
  global.homeOrtmp = os.homedir() || os.tmpdir()
  global.closeApp = () => {
    win.close()
  }

  let opts = `http://localhost:${config.port}/index.html`
  if (isDev) {
    let conf = require('../config.default')
    opts = `http://localhost:${conf.devPort}`
  }

  win.loadURL(opts)
  win.maximize()

  // Open the DevTools.

  if(isDev) win.webContents.openDevTools()

  const shortcut = globalShortcut.register('Control+2', () => {
    win.show()
  })

  if (!shortcut) {
    console.log('shortcut Registration failed.')
  }

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
