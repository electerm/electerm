/**
 * db loader
 * Provides electron-related environment to nedb/sqlite modules
 */

const { appPath, defaultUserName } = require('../common/app-props')
const { safeEncrypt, safeDecrypt } = require('./safe-storage')

const encOpts = { enc: safeEncrypt, dec: safeDecrypt }

if (process.versions.node < '22.0.0') {
  const { createDb } = require('./nedb')
  module.exports = createDb(appPath, defaultUserName, encOpts)
} else {
  const { createDb } = require('./sqlite')
  module.exports = createDb(appPath, defaultUserName, encOpts)
}
