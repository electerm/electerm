/**
 * Trzsz protocol handler for server-side terminal sessions
 * This is a minimal implementation - the actual trzsz handling is done client-side
 * using TrzszFilter from the trzsz package
 */

// Trzsz magic key prefix
const TRZSZ_MAGIC_KEY_PREFIX = '::TRZSZ:TRANSFER:'
const TRZSZ_MAGIC_KEY_REGEXP = /::TRZSZ:TRANSFER:([SRD]):(\d+\.\d+\.\d+)(:\d+)?/

/**
 * Check if data contains trzsz magic key
 * @param {Buffer|string} data - Data to check
 * @returns {boolean} - True if data contains trzsz magic key
 */
function detectTrzszStart (data) {
  let str = data
  if (Buffer.isBuffer(data)) {
    str = data.toString('binary')
  }

  const idx = str.lastIndexOf(TRZSZ_MAGIC_KEY_PREFIX)
  if (idx < 0) return false

  const buffer = str.substring(idx)
  const found = buffer.match(TRZSZ_MAGIC_KEY_REGEXP)
  return !!found
}

/**
 * TrzszManager - minimal server-side manager
 * The actual trzsz handling is done client-side using TrzszFilter
 */
class TrzszManager {
  constructor () {
    this.sessions = new Map()
  }

  /**
   * Handle data for a terminal
   * @param {string} pid - Terminal PID
   * @param {Buffer} data - Incoming data
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   * @returns {boolean} - Always returns false, let client handle trzsz
   */
  handleData (pid, data, term, ws) {
    // Don't consume data server-side, let client-side TrzszFilter handle it
    return false
  }

  /**
   * Handle client message
   * @param {string} pid - Terminal PID
   * @param {Object} msg - Message from client
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   */
  handleMessage (pid, msg, term, ws) {
    // No server-side handling needed
  }

  /**
   * Destroy session for a terminal
   * @param {string} pid - Terminal PID
   */
  destroySession (pid) {
    this.sessions.delete(pid)
  }

  /**
   * Check if terminal has active trzsz session
   * @param {string} pid - Terminal PID
   * @returns {boolean}
   */
  isActive (pid) {
    return false
  }
}

// Export singleton manager
const trzszManager = new TrzszManager()

module.exports = {
  TrzszManager,
  trzszManager,
  TRZSZ_MAGIC_KEY_PREFIX,
  detectTrzszStart
}
