/**
 * log ssh output to file
 */

const { appPath } = process.env
const { resolve } = require('path')
const { existsSync, mkdirSync, createWriteStream } = require('fs')
const logDir = resolve(
  appPath, 'electerm', 'session_logs'
)
try {
  if (!existsSync(logDir)) {
    mkdirSync(logDir)
  }
} catch (e) {
  console.debug('read default user name error')
}

class SessionLog {
  constructor (options) {
    this.options = options
    const logPath = resolve(logDir, options.fileName)
    this.stream = createWriteStream(logPath)
  }

  write (text) {
    this.stream.write(text)
  }

  destroy () {
    this.stream.destroy()
  }
}

module.exports = SessionLog
