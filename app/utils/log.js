const log = require('electron-log')

log.transports.console.format = '%c{h}:{i}:{s}%c › {text}'
log.transports.file.level = 'verbose'

module.exports = log
