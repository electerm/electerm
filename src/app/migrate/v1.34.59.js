/**
 * upgrade database to v1.34.20
 */

const { dbAction } = require('../lib/nedb')
const { userConfigId } = require('../common/constants')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../common/log')

async function fixAll () {
  log.info('Start update default terminal word separator config')
  const q = {
    _id: userConfigId
  }
  const conf = await dbAction('data', 'findOne', q)
  if (conf && conf.terminalWordSeparator && !conf.terminalWordSeparator.includes(' ')) {
    conf.terminalWordSeparator = conf.terminalWordSeparator.slice(0, 1) + ' ' +
      conf.terminalWordSeparator.slice(1)
    await dbAction('data', 'update', q, {
      ...q,
      ...conf
    })
  }
}

module.exports = async () => {
  const versionTo = '1.34.59'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
