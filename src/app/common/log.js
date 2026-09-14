const log = require('electron-log')
const { isDev } = require('./runtime-constants')

log.transports.console.format = '{h}:{i}:{s} {level} › {text}'

// electron-log 4.3.5 gets this one backwards: its isDev() returns
// app.isPackaged, so the ipc transport -- which mirrors every message to the
// renderer over webFrameMain -- stays enabled in the packaged app. That is not
// just noise: once a renderer dies, every single log call throws
// "Render frame was disposed before WebFrameMain could be accessed" and buries
// the crash that actually matters. Only keep it in dev, where it feeds devtools.
if (log.transports?.ipc) {
  log.transports.ipc.level = isDev ? 'silly' : false
}

if (!isDev) {
  log.transports.console.level = 'warn'
  log.transports.file.level = 'warn'
}

module.exports = exports.default = log
