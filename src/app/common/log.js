const log = require('electron-log')
const { isDev } = require('./runtime-constants')

log.transports.console.format = '{h}:{i}:{s} {level} › {text}'

if (!isDev) {
  log.transports.console.level = 'warn'
  log.transports.file.level = 'warn'
}

module.exports = exports.default = log
