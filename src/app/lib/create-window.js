const {
  BrowserWindow, screen, dialog, app, shell
} = require('electron')
const { resolve } = require('path')
const { readFile, writeFile } = require('fs/promises')
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
const {
  ensureWindowVisible,
  createDisplayRefitter
} = require('./window-restore')
const { onClose } = require('./on-close')
const { initIpc, initAppServer } = require('./ipc')
const { disableShortCuts } = require('./key-bind')
const _ = require('./lodash.js')
const getPort = require('./get-port')
const globalState = require('./glob-state')
const webviewHandler = require('./webview-handler')
const { installNavGuard } = require('./nav-guard')
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
  // Windows always uses a separate system title bar.
  globalState.set('systemTitleBar', isWin || !!useSystemTitleBar)
  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    fullscreenable: true,
    autoHideMenuBar: isWin,
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
    win.setMenuBarVisibility(false)
  }

  win.webContents.session.setSpellCheckerDictionaryDownloadURL('https://00.00/')

  webviewHandler.init(win)

  globalState.set('win', win)

  // A backend that cannot bind its port used to leave this await pending
  // forever: window created, nothing in it, no message, app just sits there.
  // Say it out loud instead. The usual cause on Windows is the port landing in
  // a reserved/excluded range (Hyper-V, WinNAT, WSL2, Docker Desktop) or being
  // blocked by security software -- hence the -sp hint.
  try {
    await initAppServer()
  } catch (err) {
    console.error('init app server failed:', err)
    try {
      dialog.showErrorBox(
        'electerm',
        `electerm could not start its local backend service.\n\n${err?.message || err}\n\n` +
        'This is usually a port problem. On Windows a port can be reserved by ' +
        'Hyper-V/WSL2/Docker Desktop, and security software can block it too.\n\n' +
        'Try starting electerm with another port, e.g.\n' +
        'electerm.exe -sp 40975'
      )
    } catch (_) {}
    app.quit()
    return
  }
  initIpc()
  const port = isDev
    ? process.env.devPort || 5570
    : await getPort()
  if (packInfo.uiRevision) {
    const marker = resolve(app.getPath('sessionData'), 'ui-revision')
    try {
      const previous = await readFile(marker, 'utf8').catch(err => {
        if (err.code !== 'ENOENT') throw err
      })
      if (previous !== packInfo.uiRevision) {
        // Only invalidate HTTP resources, never cookies, local storage or bookmarks.
        await win.webContents.session.clearCache()
        await writeFile(marker, packInfo.uiRevision)
      }
    } catch (err) {
      console.warn('Could not refresh the UI cache:', err.message)
    }
  }
  const opts = `http://127.0.0.1:${port}/index.html?v=${packInfo.version}`
  globalState.set('appOrigin', installNavGuard(win, opts, shell))
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

    // Windows only. Windows keeps a window's size in DIP across a per-monitor
    // DPI boundary and only refits *maximized* windows, so a window dragged
    // from a large monitor onto a smaller one is left hanging off the new
    // screen. `moved` fires once, when the drag settles; see
    // createDisplayRefitter for why this is not wired up on macOS.
    if (isWin) {
      win.on('moved', createDisplayRefitter(
        win,
        screen,
        minWindowWidth,
        minWindowHeight
      ))
    }

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
