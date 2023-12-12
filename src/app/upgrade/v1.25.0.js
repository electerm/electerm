/**
 * upgrade database to v1.7.0
 */

const { userConfigId } = require('../common/constants')
const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../common/log')

async function fixAll () {
  const q = {
    _id: userConfigId
  }
  const conf = await dbAction('data', 'findOne', q)
  if (!conf) {
    return
  }
  if (!conf.syncSetting) {
    conf.syncSetting = {}
  }
  const {
    syncEncrypt,
    githubAccessToken,
    giteeAccessToken
  } = conf.syncSetting
  if (!syncEncrypt) {
    return
  }
  if (githubAccessToken) {
    conf.syncSetting.githubSyncPassword = githubAccessToken
  }
  if (giteeAccessToken) {
    conf.syncSetting.giteeSyncPassword = giteeAccessToken
  }
  delete conf.syncSetting.syncEncrypt
  await dbAction('data', 'update', q, {
    ...q,
    ...conf
  })
}

module.exports = async () => {
  const versionTo = '1.25.0'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
