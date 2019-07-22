
// use bluebird for performance
global.Promise = require('bluebird')

const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  globalShortcut,
  shell
} = require('electron')
const { fork } = require('child_process')
const _ = require('lodash')
const getConf = require('./utils/config.default')
const sshConfigItems = require('./lib/ssh-config')
const logPaths = require('./lib/log-read')
const lookup = require('./utils/lookup')
const os = require('os')
const { resolve } = require('path')
const { instSftpKeys } = require('./server/sftp')
const { transferKeys } = require('./server/transfer')
const { saveUserConfig, userConfig } = require('./lib/user-config-controller')
const { init, changeHotkeyReg } = require('./lib/shortcut')
const { fsExport, fsFunctions } = require('./lib/fs')
const ls = require('./lib/ls')
const menu = require('./lib/menu')
const log = require('./utils/log')
const { testConnection } = require('./server/terminal')
const { saveLangConfig, lang, langs } = require('./lib/locales')
const rp = require('phin').promisified
const lastStateManager = require('./lib/last-state')
const installSrc = require('./lib/install-src')
const { isDev, packInfo } = require('./utils/app-props')
const {
  prefix
} = require('./lib/locales')
const a = prefix('app')

global.win = null
let timer
let timer1
let childPid
const iconPath = resolve(
  __dirname,
  (
    isDev
      ? '../node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
      : 'assets/images/electerm-round-128x128.png'
  )
)

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
    process.kill(childPid)
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
  const config = await getConf()

  // start server
  const child = fork(resolve(__dirname, './server/server.js'), {
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

  if (config.showMenu) {
    Menu.setApplicationMenu(menu)
  }

  const windowSizeLastState = lastStateManager.get('windowSize')
  const { width, height } = windowSizeLastState && !isDev
    ? windowSizeLastState
    : require('electron').screen.getPrimaryDisplay().workAreaSize

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
    versions: process.versions,
    sshConfigItems,
    testConnection,
    env: process.env,
    fsFunctions,
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
      return global.win.isMaximized()
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
    global.win.webContents.openDevTools()
  }

  // init hotkey
  init(globalShortcut, global.win, config)

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
