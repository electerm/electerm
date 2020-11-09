/**
 * upgrade database to v1.5.12
 */

const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')
const defaults = require('./db-defaults')

async function fixAll () {
  const q = {
    _id: 'default'
  }
  await dbAction('terminalThemes', 'update', q, defaults[0].data[0]).catch(log.error)
  await dbAction('terminalThemes', 'insert', defaults[0].data[1]).catch(log.error)
  log.info('end: update db')
}

module.exports = async () => {
  const versionTo = '1.7.0'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
