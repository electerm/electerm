const {
  app
} = require('electron')
const { createWindow } = require('./create-window')
const {
  packInfo
} = require('../common/runtime-constants')
const { initCommandLine } = require('./command-line')
const globalState = require('./glob-state')
const { getDbConfig } = require('./get-config')
const {
  setupDeepLinkHandlers
} = require('./deep-link')
const { handleSingleInstance } = require('./single-instance')

exports.createApp = async function () {
  app.setName(packInfo.name)
  if (process.platform === 'linux' || process.env.DISABLE_GPU) {
    app.commandLine.appendSwitch('--disable-gpu')
  }
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('--enable-transparent-visuals')
    app.commandLine.appendSwitch('--in-process-gpu')
  }
  if (process.platform === 'linux' || process.env.DISABLE_HARDWARE_ACCELERATION) {
    app.disableHardwareAcceleration()
  }
  if (process.env.DISABLE_GPU_SANDBOX) {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('--disable-gpu')
    app.commandLine.appendSwitch('--disable-gpu-compositing')
    app.commandLine.appendSwitch('--disable-gpu-rasterization')
    app.commandLine.appendSwitch('--disable-gpu-sandbox')
    app.commandLine.appendSwitch('--disable-software-rasterizer')
    app.commandLine.appendSwitch('--use-gl', 'swiftshader')
  }
  // Handle proxy-related command-line arguments
  if (process.env.NO_PROXY_SERVER) {
    app.commandLine.appendSwitch('no-proxy-server')
  }
  if (process.env.PROXY_BYPASS_LIST) {
    app.commandLine.appendSwitch('proxy-bypass-list', process.env.PROXY_BYPASS_LIST)
  }
  if (process.env.PROXY_PAC_URL) {
    app.commandLine.appendSwitch('proxy-pac-url', process.env.PROXY_PAC_URL)
  }
  if (process.env.PROXY_SERVER) {
    app.commandLine.appendSwitch('proxy-server', process.env.PROXY_SERVER)
  }

  const progs = initCommandLine()
  const opts = progs?.options
  const conf = await getDbConfig()
  globalState.set('serverPort', opts?.serverPort)

  const { allowMultiInstance = false } = conf

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

  app.on('second-instance', () => {
    // Just focus the window - data is handled via socket
    const win = globalState.get('win')
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
    }
  })
  app.whenReady().then(() => createWindow(conf))
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (globalState.get('win') === null) {
      app.once('ready', () => createWindow(conf))
    }
  })
  return app
}
