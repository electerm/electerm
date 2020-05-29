/**
 * upgrade database to v1.3.35
 * migrate old file based db to nedb
 */

const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')

async function fixAll () {
  await dbAction('data', 'update', {
    _id: 'exitStatus'
  }, {
    value: 'ok',
    _id: 'exitStatus'
  }, {
    upsert: true
  })
  await dbAction('data', 'update', {
    _id: 'sessions'
  }, {
    value: null,
    _id: 'sessions'
  }, {
    upsert: true
  })
}

module.exports = async () => {
  const versionTo = '1.3.35'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
