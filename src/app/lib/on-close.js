/**
 * on close app
 */

const { dbAction } = require('./nedb')
const log = require('../common/log')

exports.getExitStatus = async () => {
  const res = await dbAction('data', 'findOne', {
    _id: 'exitStatus'
  })
  return res && res.value ? res.value : ''
}

exports.onClose = async function (e) {
  if (global.et.config.confirmBeforeExit && global.et.closeAction) {
    global.win?.webContents.send(
      'confirm-exit',
      global.et.closeAction
    )
    global.et.closeAction = ''
    return e.preventDefault()
  }
  log.debug('Closing app')
  global.childPid && process.kill(global.childPid)
  process.on('uncaughtException', function () {
    global.childPid && process.kill(global.childPid)
    process.exit(0)
  })
  log.debug('Child process killed')
  // await dbAction('data', 'update', {
  //   _id: 'exitStatus'
  // }, {
  //   value: 'ok',
  //   _id: 'exitStatus'
  // }, {
  //   upsert: true
  // })
  // await dbAction('data', 'update', {
  //   _id: 'sessions'
  // }, {
  //   value: null,
  //   _id: 'sessions'
  // }, {
  //   upsert: true
  // })
  // log.debug('session saved')
  clearTimeout(global.et.timer)
  global.win = null
  global.app.quit()
}
