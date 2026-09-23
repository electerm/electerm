/**
 * upgrade database to v1.7.0
 */

const { dbAction } = require('./nedb-instance')
const { updateDBVersion } = require('./version-upgrade')
const log = require('../common/log')
const defaults = require('../upgrade/db-defaults')

async function fixAll () {
  const terminalThemesDefaults = Array.isArray(defaults)
    ? defaults.find(d => d && d.db === 'terminalThemes')
    : null
  const defaultThemeConfig = terminalThemesDefaults && terminalThemesDefaults.data[0]
  const defaultLightThemeConfig = terminalThemesDefaults && terminalThemesDefaults.data[1]
  if (!defaultThemeConfig || !defaultLightThemeConfig) {
    log.error('v1.7.0: missing default theme configs, skipping theme fix')
    return
  }
  const all = await dbAction('terminalThemes', 'find', {}).catch(log.error) || []
  for (const item of all) {
    const id = item.id || item._id
    if (!id) {
      continue
    }
    const q = {
      _id: id
    }
    const updates = id === 'default'
      ? {
          ...defaultThemeConfig,
          _id: 'default'
        }
      : {
          ...item,
          _id: id,
          uiThemeConfig: defaultThemeConfig.uiThemeConfig
        }
    delete updates.id
    await dbAction('terminalThemes', 'update', q, updates).catch(log.error)
  }
  const existed = await dbAction('terminalThemes', 'findOne', {
    _id: defaultLightThemeConfig._id
  }).catch(log.error)
  if (!existed) {
    await dbAction('terminalThemes', 'insert', defaultLightThemeConfig).catch(log.error)
  }
  log.info('end: update db')
}

module.exports = async () => {
  const versionTo = '1.7.0'
  log.info(`Start: upgrading to v${versionTo}`)
  await fixAll()
  await updateDBVersion(versionTo)
  log.info(`Done: upgrading to v${versionTo}`)
}
