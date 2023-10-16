const {
  app
} = require('electron')
const { createWindow } = require('./create-window')
const {
  packInfo
} = require('../common/runtime-constants')
const { initCommandLine } = require('./command-line')

exports.createApp = function () {
  app.setName(packInfo.name)
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('--enable-transparent-visuals')
    app.commandLine.appendSwitch('--disable-gpu')
    app.commandLine.appendSwitch('--in-process-gpu')
    app.disableHardwareAcceleration()
  }
  const progs = initCommandLine()
  const opts = progs?.options
  global.serverPort = opts?.serverPort
  const useStandAloneWindow = opts?.newWindow
  let gotTheLock = false
  if (!useStandAloneWindow) {
    gotTheLock = app.requestSingleInstanceLock(progs)
  }
  if (
    !gotTheLock &&
    !useStandAloneWindow &&
    opts &&
    Object.keys(opts).length
  ) {
    app.quit()
  } else if (!gotTheLock) {
    global.isSencondInstance = true
    app.isSencondInstance = true
  }
  app.on('second-instance', (event, argv, wd, opts) => {
    if (global.win) {
      if (global.win.isMinimized()) {
        global.win.restore()
      }
      global.win.focus()
      if (opts) {
        global.win.webContents.send('add-tab-from-command-line', opts)
      }
    }
  })
  app.on('ready', createWindow)
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (global.win === null) {
      app.once('ready', createWindow)
    }
  })
  return app
}
