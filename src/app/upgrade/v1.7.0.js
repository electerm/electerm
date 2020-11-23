/**
 * upgrade database to v1.5.12
 */

const { dbAction } = require('../lib/nedb')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../utils/log')
const defaults = require('./db-defaults')

async function fixAll () {
  const defaultThemeConfig = defaults[0].data[0]
  const defaultLightThemeConfig = defaults[0].data[1]
  const all = await dbAction('terminalThemes', 'find', {}).catch(log.error) || []
  for (const item of all) {
    const q = {
      _id: item.id || item._id
    }
    const updates = q._id === 'default'
      ? defaultThemeConfig
      : {
        ...item,
        uiThemeConfig: defaultThemeConfig.uiThemeConfig
      }
    await dbAction('terminalThemes', 'update', q, updates).catch(log.error)
  }
  await dbAction('terminalThemes', 'insert', defaultLightThemeConfig).catch(log.error)
  log.info('end: update db')
}

module.exports = async () => {
  const versionTo = '1.7.0'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
