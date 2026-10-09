const {
  BrowserWindow, screen
} = require('electron')
const { resolve } = require('path')
const {
  isDev, packInfo, iconPath, isMac, isWin,
  minWindowWidth, minWindowHeight
} = require('../common/runtime-constants')
const defaults = require('../common/default-setting')
const {
  getWindowSize,
  setWindowPos,
  repairFullScreenGeometry
} = require('./window-control')
const { ensureWindowVisible } = require('./window-restore')
const { onClose } = require('./on-close')
const { initIpc, initAppServer } = require('./ipc')
const { disableShortCuts } = require('./key-bind')
const _ = require('./lodash.js')
const getPort = require('./get-port')
const globalState = require('./glob-state')
const webviewHandler = require('./webview-handler')
const { getTitleBarOptions, windowBackground } = require('./title-bar')

// A crashed / reloaded renderer leaves the window object alive, and sending to
// it then throws "Render frame was disposed before WebFrameMain could be
// accessed" -- which is exactly what floods the log after a renderer dies.
function safeSend (win, channel, data) {
  try {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      return
    }
    win.webContents.send(channel, data)
  } catch (err) {
    // renderer is gone, nothing to deliver to
  }
}

exports.createWindow = async function (userConfig) {
  globalState.set('closeAction', 'closeApp')
  globalState.set('requireAuth', !!userConfig.hashedPassword)
  const { width, height, x, y } = await getWindowSize()
  const { useSystemTitleBar = defaults.useSystemTitleBar } = userConfig
  // Windows always keeps the native frame (window controls overlay, see
  // title-bar.js), so the renderer must treat the frame as the system one there
  // regardless of the setting; useSystemTitleBar only decides the macOS/Linux
  // chrome.
  globalState.set('systemTitleBar', isWin || !!useSystemTitleBar)
  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    fullscreenable: true,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    title: packInfo.name,
    backgroundColor: windowBackground,
    // frame / transparent / titleBarStyle / titleBarOverlay, per platform
    ...getTitleBarOptions(useSystemTitleBar, isWin),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: resolve(__dirname, '../preload/preload.js'),
      webviewTag: true,
      devTools: !userConfig.disableDeveloperTool,
      spellcheck: false
    },
    icon: iconPath
  })
  // Safety net: verify the window is actually visible on a connected
  // display and move it to the primary display if not.
  ensureWindowVisible(win, screen)
  // hides the traffic lights
  if (isMac) {
    win.setWindowButtonVisibility(true)
  } else if (useSystemTitleBar && !isWin) {
    // The system title bar would otherwise show Electron's default
    // Edit/View/Window/Help menu bar; hide it (its keyboard accelerators still
    // work). Windows is excluded on purpose: there the window is frameless
    // (titleBarStyle 'hidden'), RootView::SetMenu bails out for a frameless
    // window and no menu bar is ever created, so the call would be a no-op.
    win.setMenuBarVisibility(false)
  }

  win.webContents.session.setSpellCheckerDictionaryDownloadURL('https://00.00/')

  webviewHandler.init(win)

  globalState.set('win', win)

  await initAppServer()
  initIpc()
  const port = isDev
    ? process.env.devPort || 5570
    : await getPort()
  const opts = `http://127.0.0.1:${port}/index.html?v=${packInfo.version}`
  // If loading the URL fails (e.g. proxy/firewall interference), show error page
  win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load app URL:', errorCode, errorDescription)
    const htmlContent = require('./error-page')(port)
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
    win.loadURL(dataUrl)
  })
  win.loadURL(opts)
  win.webContents.once('dom-ready', () => {
    if (isDev && !userConfig.disableDeveloperTool) {
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
    win.on('resize', _.debounce(() => {
      if (!win.isMaximized()) {
        globalState.set('oldRectangle', win.getBounds())
      }
    }, 200))
    win.on('move', _.debounce(() => {
      const { x, y } = win.getBounds()
      setWindowPos({ x, y })
    }, 100))

    win.on('focus', () => {
      safeSend(win, 'focused', null)
    })
    win.on('blur', () => {
      safeSend(win, 'blur', null)
    })
    // macOS only: in native fullscreen, switching between apps goes through
    // the Spaces transition, which can leave the window frame stuck at an
    // intermediate (about half height) size — no resize event follows. Check
    // (and repair) the fullscreen bounds after the transitions settle; if the
    // frame was repaired, the resize event recovers the renderer with its
    // normal logic.
    if (isMac) {
      const repairGeometry = () => repairFullScreenGeometry()
      win.on('focus', () => {
        if (win.isFullScreen()) {
          setTimeout(repairGeometry, 300)
          setTimeout(repairGeometry, 800)
          setTimeout(repairGeometry, 1500)
        }
      })
      win.on('enter-full-screen', () => {
        setTimeout(repairGeometry, 300)
        setTimeout(repairGeometry, 800)
        setTimeout(repairGeometry, 1500)
      })
    }
    disableShortCuts(win)
  })
  win.on('close', onClose)
}
