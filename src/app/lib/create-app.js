const {
  app
} = require('electron')
const { createWindow } = require('./create-window')
const {
  packInfo
} = require('../common/runtime-constants')
const { initCommandLine } = require('./command-line')
const globalState = require('./glob-state')
const { getUserConfigNoEnc, getDbConfig } = require('./get-config')
const {
  setupDeepLinkHandlers
} = require('./deep-link')
const { handleSingleInstance } = require('./single-instance')
const { setupCrashReporter, setupCommandLineSwitches } = require('./crash-reporter')

let conf = {}

setupCrashReporter()

exports.createApp = async function () {
  app.setName(packInfo.name)
  // Set desktop name so Linux taskbars (e.g. UOS/Deepin dde-dock) can match
  // the window to the .desktop file embedded in the AppImage.
  if (process.platform === 'linux' && app.setDesktopName) {
    app.setDesktopName(packInfo.name)
  }
  setupCommandLineSwitches()

  const progs = initCommandLine()
  const opts = progs?.options
  globalState.set('serverPort', opts?.serverPort)

  const { allowMultiInstance = false } = await getUserConfigNoEnc()

  // Setup deep link handlers (open-url for macOS, etc.)
  setupDeepLinkHandlers()
  // Only request single instance lock if multi-instance is not allowed
  if (!allowMultiInstance) {
    // Use socket-based single instance lock for compatibility with Electron 22
    // where additionalData doesn't work in the second-instance event
    const isPrimaryInstance = await handleSingleInstance(progs)

    if (!isPrimaryInstance) {
      app.quit()
      return app
    }

    // Also use Electron's built-in lock as a fallback
    app.requestSingleInstanceLock()
  }

  app.on('second-instance', (event, commandLine) => {
    const newWindowFlag = commandLine.includes('--new-window')
    if (newWindowFlag) {
      createWindow(conf)
      return
    }
    const win = globalState.get('win')
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
    }
  })
  app.whenReady().then(async () => {
    conf = await getDbConfig()
    createWindow(conf)
  })
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (globalState.get('win') === null) {
      app.once('ready', () => createWindow(conf))
    }
  })
  return app
}
