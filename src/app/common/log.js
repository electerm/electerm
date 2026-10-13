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

// Levels for the packaged app. `warn` is right for a release, but it silently
// ate the whole SSH protocol trace: session-ssh.js hands ssh2
// `connectOptions.debug = log.log`, and log.log is level `info`, so with the
// `debug` setting on the app asked ssh2 for a trace that could never reach
// ~/.config/electerm/logs/main.log -- exactly the evidence an "old switch
// refuses to connect" report needs (Local ident / Remote ident / the kex line).
// Debug mode therefore has to move the level as well as the flag.
const DEBUG_LEVEL = 'debug'
const PROD_LEVEL = 'warn'

// Inherited by the forked server process (see ../server/child-process.js), which
// then opens up at load time; a session opened later follows the setting too
// (../server/session-ssh.js), so no restart is needed.
const DEBUG_ENV = 'ELECTERM_DEBUG'

/**
 * @param {boolean} [dev] defaults to isDev, injectable for the same reason as
 *   setDebugMode's second argument
 * @returns {boolean}
 */
function isDebugMode (dev = isDev) {
  return dev || process.env[DEBUG_ENV] === '1'
}

/**
 * Turn verbose logging on/off. Exported as `log.setDebugMode`.
 * @param {boolean} enabled
 * @param {boolean} [dev] defaults to isDev. Injectable because the packaged
 *   level policy has to be testable: runtime-constants resolves its package.json
 *   relative to the packaged app layout, so a test cannot run with
 *   NODE_ENV=production in a source checkout.
 */
function setDebugMode (enabled = true, dev = isDev) {
  process.env[DEBUG_ENV] = enabled ? '1' : ''
  // dev already logs everything
  const level = dev ? 'silly' : (enabled ? DEBUG_LEVEL : PROD_LEVEL)
  log.transports.file.level = level
  log.transports.console.level = level
}

setDebugMode(isDebugMode())

log.setDebugMode = setDebugMode
log.isDebugMode = isDebugMode

module.exports = exports.default = log
