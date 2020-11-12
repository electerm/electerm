/**
 * for new user, they do not have old json db
 * just need init db
 */

const { dbAction } = require('../lib/nedb')
const log = require('../utils/log')
const defaults = require('./db-defaults')

async function initData () {
  log.info('start: init db')
  for (const conf of defaults) {
    const {
      db, data
    } = conf
    await dbAction(db, 'insert', data).catch(log.error)
  }
  log.info('end: init db')
}

module.exports = initData
