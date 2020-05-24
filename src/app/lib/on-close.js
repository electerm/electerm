/**
 * on close app
 */

const { dbAction } = require('./nedb')
const log = require('../utils/log')

exports.getExitStatus = async () => {
  const res = await dbAction('data', 'findOne', {
    _id: 'exitStatus'
  })
  return res && res.value ? res.value : ''
}

exports.onClose = async function () {
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
  clearTimeout(global.et.timer1)
  global.win = null
  global.app.quit()
}
