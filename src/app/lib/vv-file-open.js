/**
 * Open a .vv connection file that the operating system handed to electerm.
 *
 * Reached when electerm is registered as a handler for .vv (see
 * `fileAssociations` in build/electron-builder.json) and the user double-clicks
 * one, or runs `open -a electerm console.vv` on macOS. Windows and Linux do not
 * have this event: a file association there launches us with the path as an
 * argument instead, which src/app/lib/command-line.js picks up.
 *
 * The payload sent to the renderer is `{ vvFile }` -- deliberately the same
 * shape `initCommandLine()` returns, so the renderer needs no second entry
 * point. 'add-tab-from-command-line' already routes it to
 * addTabFromCommandLine() -> openVvFile().
 */
const { app } = require('electron')
const log = require('../common/log')
const globalState = require('./glob-state')
const { isVvFile } = require('../common/vv-file')

/**
 * Hand a path to the renderer, or remember it until there is one that can
 * receive it.
 *
 * The stash is not just for the no-window case. `main.jsx` registers the
 * 'add-tab-from-command-line' listener in a useEffect, so a push that lands
 * while the page is still loading is dropped on the floor; `isLoading()` is
 * false only once the document has finished loading, and the renderer drains
 * the stash as it mounts. Without that gate a double-click during startup
 * would silently do nothing.
 *
 * @param {string} filePath
 * @returns {boolean} whether the path looked like a .vv file
 */
function openVvFileFromOs (filePath) {
  if (!isVvFile(filePath)) {
    log.warn('open-file for a non-.vv path, ignoring:', filePath)
    return false
  }
  const win = globalState.get('win')
  const canReceive = win &&
    !win.isDestroyed() &&
    !win.webContents.isLoading()
  if (canReceive) {
    if (win.isMinimized()) {
      win.restore()
    }
    win.focus()
    win.webContents.send('add-tab-from-command-line', { vvFile: filePath })
  } else {
    globalState.set('pendingVvFile', filePath)
  }
  return true
}

/**
 * Take the file that arrived before the window did, if any.
 * Cleared on read, so a reload does not open it twice.
 *
 * @returns {{vvFile: string}|null}
 */
function getPendingVvFile () {
  const pending = globalState.get('pendingVvFile')
  if (pending) {
    globalState.set('pendingVvFile', null)
    return { vvFile: pending }
  }
  return null
}

/**
 * Register the OS handlers. Must run before app.whenReady() -- macOS may
 * deliver 'open-file' during launch, and an event with no listener is dropped.
 */
function setupVvFileHandlers () {
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    log.info('open-file event:', filePath)
    openVvFileFromOs(filePath)
  })
}

module.exports = {
  openVvFileFromOs,
  getPendingVvFile,
  setupVvFileHandlers
}
