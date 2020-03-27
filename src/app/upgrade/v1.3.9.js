/**
 * upgrade database to v1.3.9
 * migrate old file based db to nedb
 */

const { dbAction, tables } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')

function wait (time) {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}

async function fixAll () {
  for (const name of tables) {
    const all = await dbAction(name, 'find', {})
    for (const inst of all) {
      const { id, _id, ...rest } = inst
      if (id) {
        await dbAction(name, 'remove', {
          id
        })
        await dbAction(name, 'remove', {
          _id: id
        }, { multi: true })
        await wait(100)
        await dbAction(name, 'insert', {
          _id: id,
          ...rest
        })
      }
    }
  }
}

module.exports = async () => {
  const versionTo = '1.3.9'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
