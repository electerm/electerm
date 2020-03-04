
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
const { fork } = require('child_process')
const getConf = require('./utils/config.default')
const sshConfigItems = require('./lib/ssh-config')
const logPaths = require('./lib/log-read')
const lookup = require('./utils/lookup')
const os = require('os')
const { resolve } = require('path')
const { instSftpKeys } = require('./server/session')
const { transferKeys } = require('./server/transfer')
const { saveUserConfig, userConfig } = require('./lib/user-config-controller')
const { init, changeHotkeyReg } = require('./lib/shortcut')
const { fsExport, fsFunctions } = require('./lib/fs')
const ls = require('./lib/ls')
const menu = require('./lib/menu')
const log = require('./utils/log')
const { testConnection } = require('./server/session')
const { saveLangConfig, lang, langs, sysLocale } = require('./lib/locales')
const rp = require('phin').promisified
const lastStateManager = require('./lib/last-state')
const installSrc = require('./lib/install-src')
const {
  isDev, packInfo, iconPath,
  minWindowWidth, minWindowHeight
} = require('./utils/app-props')
const { getWindowSize, getScreenSize } = require('./utils/window-size')
const {
  prefix
} = require('./lib/locales')
const { loadFontList } = require('./lib/font-list')
const { encrypt, decrypt } = require('./lib/enc')
const a = prefix('app')
require('./lib/tray')

global.win = null
let timer
let timer1
let childPid

function onClose () {
  log.debug('close app')
  ls.set({
    exitStatus: 'ok',
    sessions: null
  })
  process.nextTick(() => {
    clearTimeout(timer)
    clearTimeout(timer1)
    global.win = null
    childPid && process.kill(childPid)
    process.on('uncaughtException', function () {
      process.exit(0)
    })
    process.exit(0)
  })
}

async function waitUntilServerStart (url) {
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

log.debug('App starting...')

async function createWindow () {
  session.defaultSession.webRequest.onBeforeRequest((details, done) => {
    const redirectURL = details.url.replace(/^devtools:\/\/devtools\/remote\/serve_file\/@[0-9a-f]{40}/, 'https://chrome-devtools-frontend.appspot.com/serve_file/@675968a8c657a3bd9c1c2c20c5d2935577bbc5e6')
    if (redirectURL !== details.url) {
      done({ redirectURL })
    } else {
      done({})
    }
  })
  const config = await getConf()
  // start server
  const child = fork(resolve(__dirname, './server/server.js'), {
    env: Object.assign(
      {
        LANG: `${sysLocale.replace(/-/, '_')}.UTF-8`,
        electermPort: config.port,
        electermHost: config.host
      },
      process.env
    ),
    cwd: process.cwd()
  }, (error, stdout, stderr) => {
    if (error || stderr) {
      throw error || stderr
    }
    log.info(stdout)
  })

  child.on('exit', () => {
    childPid = null
  })

  childPid = child.pid

  if (config.showMenu) {
    Menu.setApplicationMenu(menu)
  }

  const { width, height } = getWindowSize()

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
    timer1 = setTimeout(() => global.win.hide(), 500)
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${a('isRunning')}, ${a('press')} ${config.hotkey} ${a('toShow')}`
      })
      notice.show()
    }
  }

  global.et = {
    exitStatus: process.argv.includes('--no-session-restore')
      ? 'ok' : ls.get('exitStatus')
  }
  Object.assign(global.et, {
    loadFontList,
    _config: config,
    installSrc,
    instSftpKeys,
    transferKeys,
    upgradeKeys: transferKeys,
    fs: fsExport,
    ls,
    logPaths,
    getExitStatus: () => global.et.exitStatus,
    setExitStatus: (status) => {
      global.et.exitStatus = status
    },
    popup: (options) => {
      Menu.getApplicationMenu().popup(options)
    },
    getScreenSize,
    versions: process.versions,
    sshConfigItems,
    testConnection,
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

  timer = setTimeout(() => {
    ls.set('exitStatus', 'unknown')
    saveLangConfig(saveUserConfig, userConfig)
  }, 100)

  let opts = require('url').format({
    protocol: 'file',
    slashes: true,
    pathname: resolve(__dirname, 'assets', 'index.html')
  })

  const childServerUrl = `http://localhost:${config.port}/run`
  if (isDev) {
    const { devPort = 5570 } = process.env
    opts = `http://localhost:${devPort}`
  }

  await waitUntilServerStart(childServerUrl)

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

// Quit when all windows are closed.
app.on('window-all-closed', onClose)

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (global.win === null) {
    createWindow()
  }
})
