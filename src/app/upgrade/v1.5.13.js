/**
 * upgrade database to v1.5.12
 */

const { userConfigId } = require('../common/constants')
const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')
const { decrypt } = require('../lib/enc')

async function fixAll () {
  const q = {
    _id: userConfigId
  }
  const conf = await dbAction('data', 'findOne', q)
  if (!conf.syncSetting) {
    conf.syncSetting = {}
  }
  const {
    encrypted,
    gistId,
    githubAccessToken,
    lastSyncTime
  } = conf.syncSetting
  if (lastSyncTime) {
    conf.syncSetting.githubLastSyncTime = lastSyncTime
  }
  if (gistId) {
    conf.syncSetting.githubGistId = gistId
  }
  if (
    encrypted &&
    gistId &&
    githubAccessToken
  ) {
    const nt = decrypt(
      conf.syncSetting.githubAccessToken,
      conf.syncSetting.gistId
    )
    conf.syncSetting.githubAccessToken = nt
  }
  delete conf.syncSetting.encrypted
  delete conf.syncSetting.lastSyncTime
  delete conf.syncSetting.gistId
  await dbAction('data', 'update', q, {
    ...q,
    ...conf
  })
}

module.exports = async () => {
  const versionTo = '1.5.13'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
