/**
 * read log
 */

const {
  packInfo: {
    name: appName
  }
} = require('../utils/constants')
const findLogPath = require('electron-log/lib/transports/file/findLogPath')
const oldLogPath = findLogPath(appName, 'log.old.log')
const logPath = findLogPath(appName, 'log.log')

module.exports = {
  oldLogPath,
  logPath
}
