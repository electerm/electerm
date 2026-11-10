/**
 * on close window
 */

const { dbAction } = require('./db')
const { app } = require('electron')
const log = require('../common/log')
const globalState = require('./glob-state')
const {
  getWindowState,
  getWindows,
  setCloseAction
} = require('./window-manager')

exports.getExitStatus = async () => {
  const res = await dbAction('data', 'findOne', {
    _id: 'exitStatus'
  })
  return res && res.value ? res.value : ''
}

exports.onClose = async function (e, win) {
  const config = globalState.get('config')
  const quitting = globalState.get('quitting')
  const closeAction = getWindowState(win)?.closeAction
  if (config.confirmBeforeExit && closeAction) {
    globalState.set('quitting', false)
    win.webContents.send('confirm-exit', quitting ? 'quit' : closeAction)
    setCloseAction(win, '')
    return e.preventDefault()
  }
  if (getWindows().length > 1 && !quitting) {
    log.debug('Closing window')
    return
  }
  if (globalState.get('serverInited')) {
    log.debug('Closing app')
    const childPid = globalState.get('childPid')
    childPid && process.kill(childPid)
    globalState.set('serverInited', false)
    process.on('uncaughtException', function () {
      const childPid = globalState.get('childPid')
      childPid && process.kill(childPid)
      process.exit(0)
    })
    log.debug('Child process killed')
  }
  clearTimeout(globalState.get('timer'))
  if (!quitting) {
    app.quit()
  }
}
