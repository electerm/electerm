const {
  app
} = require('electron')
const { createWindow } = require('./create-window')
const {
  packInfo,
  isDev
} = require('../common/runtime-constants')
const { initCommandLine } = require('./command-line')
const globalState = require('./glob-state')
const { getDbConfig } = require('./get-config')

exports.createApp = async function () {
  app.setName(packInfo.name)
  if (isDev) {
    app.disableHardwareAcceleration()
  }
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('--enable-transparent-visuals')
    app.commandLine.appendSwitch('--disable-gpu')
    app.commandLine.appendSwitch('--in-process-gpu')
    app.disableHardwareAcceleration()
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

  // Only request single instance lock if multi-instance is not allowed
  if (!allowMultiInstance) {
    const gotTheLock = app.requestSingleInstanceLock(progs)

    // If this is a second instance, quit immediately
    if (!gotTheLock) {
      app.quit()
      return app
    }
  }

  app.on('second-instance', (event, argv, wd, opts) => {
    const win = globalState.get('win')
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
      if (opts) {
        win.webContents.send('add-tab-from-command-line', opts)
      }
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
