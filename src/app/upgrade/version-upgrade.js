/**
 * upgrade db version
 */

/**
 * common data upgrade process
 * It will check current version in db and check version in package.json,
 * run every upgrade script one by one
 */

const log = require('../utils/log')
const { dbAction } = require('../lib/nedb')

async function updateDBVersion (toVersion) {
  const versionQuery = {
    _id: 'version'
  }
  log.info('upgrade db version to', toVersion)
  await dbAction('data', 'update', versionQuery, {
    ...versionQuery,
    value: toVersion
  }, {
    upsert: true
  })
    .catch(e => {
      log.error(e)
      log.error('upgrade db version error', toVersion)
    })
  await dbAction('dbUpgradeLog', 'insert', {
    time: Date.now(),
    toVersion
  })
    .catch(e => {
      log.error(e)
      log.error('insert dbUpgradeLog error', toVersion)
    })
}

exports.updateDBVersion = updateDBVersion
