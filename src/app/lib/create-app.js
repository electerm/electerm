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
const log = require('../common/log')

// GPU error suggestion message
const GPU_ERROR_SUGGESTION = `
================================================================================
⚠️  GPU Process Error Detected
================================================================================
If you encounter GPU process crashes (exit_code=-2147483645 or similar),
try running electerm with one of these flags:

  1. --no-sandbox          (Recommended - run without sandbox)
  2. --disable-gpu        (Disable GPU rendering)
  3. --disable-gpu-sandbox (Disable GPU sandbox)
  4. --disable-hardware-acceleration

Or set environment variable:
  set DISABLE_GPU=1

Example:
  electerm.exe --no-sandbox
  or
  set DISABLE_GPU=1 && electerm.exe
================================================================================
`

// Handle GPU process crashes
app.on('gpu-process-crashed', (event, killed) => {
  log.error(`GPU process crashed, killed: ${killed}`)
  console.error(GPU_ERROR_SUGGESTION)
})

// Handle render process gone events
app.on('render-process-gone', (event, webContents, details) => {
  if (details.reason === 'crashed' || details.reason === 'abnormal-exit') {
    log.error(`Render process gone: ${details.reason}`, details)
    console.error(GPU_ERROR_SUGGESTION)
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const errorMsg = error?.message || ''
  // Check if it's GPU related
  if (
    errorMsg.includes('GPU') ||
    errorMsg.includes('gpu') ||
    errorMsg.includes('graphics') ||
    errorMsg.includes('Vulkan') ||
    errorMsg.includes('DXGI')
  ) {
    console.error(GPU_ERROR_SUGGESTION)
  }
})

exports.createApp = async function () {
  app.setName(packInfo.name)
  // Handle GPU issues on Linux
  // On Linux, disable GPU for compatibility
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
