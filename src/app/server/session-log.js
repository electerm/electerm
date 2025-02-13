/**
 * log ssh output to file
 */

const { resolve } = require('path')
const { existsSync, mkdirSync, createWriteStream } = require('fs')

function mkLogDir (logDir) {
  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir)
    }
  } catch (e) {
    console.debug('read default user name error')
  }
}

class SessionLog {
  constructor (options) {
    this.options = options
    const { logDir } = options
    const logPath = resolve(logDir, options.fileName)
    mkLogDir(logDir)
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
