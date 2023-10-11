/**
 * upgrade database to v1.34.20
 */

const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../common/log')
const { buildRunScripts } = require('../common/build-run-scripts')

async function fixBookmarks () {
  log.info('Start update bookmark loginScript config')
  const arr = await dbAction('bookmarks', 'find', {})
  const len = arr.length
  let i = 0
  log.info('bookmarks count:', len)
  for (const b of arr) {
    console.log(i + 1, b._id, b.loginScript ? 'has loginScript' : 'no loginScript')
    if (b.loginScript) {
      const runScripts = buildRunScripts(b)
      delete b.loginScript
      delete b.loginScriptDelay
      await dbAction('bookmarks', 'update', {
        _id: b._id
      }, {
        ...b,
        runScripts
      })
    }
    i = i + 1
  }
}

async function fixAll () {
  await fixBookmarks()
}

module.exports = async () => {
  const versionTo = '1.34.20'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
