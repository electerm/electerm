/**
 * upgrade database to v1.5.12
 */

const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')
const { enc } = require('../common/pass-enc')

async function fixAll () {
  const bookmarks = await dbAction('bookmarks', 'find', {})
  for (const b of bookmarks) {
    if (b.password) {
      await dbAction('bookmarks', 'update', {
        _id: b._id
      }, {
        ...b,
        passwordEncrypted: true,
        password: enc(b.password)
      })
    }
  }
  log.info('end: update db')
}

module.exports = async () => {
  const versionTo = '1.12.21'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
