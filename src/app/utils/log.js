import log from 'electron-log'

log.transports.console.format = '%c{h}:{i}:{s}%c › {text}'
log.transports.file.level = 'verbose'

export default log
