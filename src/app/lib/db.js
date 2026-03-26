/**
 * db loader
 * Provides electron-related environment to nedb/sqlite modules
 */

const { appPath, defaultUserName } = require('../common/app-props')

if (process.versions.node < '22.0.0') {
  const { createDb } = require('./nedb')
  module.exports = createDb(appPath, defaultUserName)
} else {
  const { createDb } = require('./sqlite')
  module.exports = createDb(appPath, defaultUserName)
}
