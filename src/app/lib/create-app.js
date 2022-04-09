
const {
  app
} = require('electron')
const { createWindow } = require('./create-window')
const {
  packInfo
} = require('../common/runtime-constants')
const { parseCommandLine, initCommandLine } = require('./command-line')

exports.createApp = function () {
  app.setName(packInfo.name)
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('--enable-transparent-visuals')
    app.commandLine.appendSwitch('--disable-gpu')
    app.commandLine.appendSwitch('--in-process-gpu')
    app.disableHardwareAcceleration()
  }
  const opts = initCommandLine()?.options
  const useStandAloneWindow = opts?.newWindow
  let gotTheLock = false
  if (!useStandAloneWindow) {
    gotTheLock = app.requestSingleInstanceLock()
  }
  if (
    !gotTheLock &&
    !useStandAloneWindow &&
    opts &&
    Object.keys(opts).length
  ) {
    app.quit()
  } else if (!gotTheLock) {
    app.isSencondInstance = true
  }
  app.on('second-instance', (event, argv, wd) => {
    const prog = parseCommandLine(argv)
    const opts = {
      options: prog.opts(),
      argv,
      helpInfo: prog.helpInformation()
    }
    if (global.win) {
      if (global.win.isMinimized()) {
        global.win.restore()
      }
      global.win.focus()
      global.win.webContents.send('add-tab-from-command-line', opts)
    }
  })
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow)
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (global.win === null) {
      createWindow()
    }
  })
  app.createWindow = createWindow
  return app
}
