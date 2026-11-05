/**
 * log ssh output to file
 */

const { resolve } = require('path')
const { existsSync, mkdirSync, createWriteStream } = require('fs')

/**
 * Create the log dir, parents included.
 *
 * `mkdirSync` without `recursive` fails when the parent is missing, and the
 * error used to be swallowed here -- the failed write stream then threw on the
 * next tick (ENOENT on open), and the session server turns an uncaught
 * exception into `cleanup()`: one unusable log path killed the session a second
 * after it connected, while the bookmark itself was fine (#4688). A log path
 * carried over from another computer (different user profile, a
 * OneDrive-redirected Documents folder) is exactly that case.
 *
 * @param {string} logDir
 * @returns {string|null} why it could not be created, or null
 */
function mkLogDir (logDir) {
  try {
    if (logDir && !existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    return null
  } catch (e) {
    return e.message
  }
}

class SessionLog {
  constructor (options) {
    this.options = options
    const { logDir } = options
    // resolve('', name) would be the cwd
    const logPath = resolve(logDir || '.', options.fileName)
    this.ready = false
    this.error = null
    const dirError = mkLogDir(logDir)
    if (dirError) {
      this.error = dirError
      return
    }
    let stream
    try {
      stream = createWriteStream(logPath, { flags: 'a' })
    } catch (e) {
      // a synchronous throw here is fatal to the session as well
      this.error = e.message
      return
    }
    // A write stream with no 'error' listener re-throws on the next tick, which
    // the session server can only see as a fatal uncaught exception. Losing the
    // log must never cost the session, so the failure stays in here (#4688).
    stream.on('error', (e) => {
      this.error = e.message
      this.ready = false
      this.stream = null
    })
    this.stream = stream
    this.ready = true
  }

  write (text) {
    if (!this.stream || !this.ready) {
      return
    }
    try {
      this.stream.write(text)
    } catch (e) {
      this.error = e.message
      this.ready = false
    }
  }

  destroy () {
    const stream = this.stream
    this.stream = null
    this.ready = false
    if (stream) {
      stream.destroy()
    }
  }
}

module.exports = SessionLog
