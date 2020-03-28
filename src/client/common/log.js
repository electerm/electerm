const log = require('electron-log')

log.transports.console.format = '{h}:{i}:{s} {level} › {text}'

window.log = log
