/**
 * terminal/sftp/serial class
 */

/**
 * Dynamically load a module based on terminal type
 * @param {string} type - Terminal type
 * @returns {Object} The loaded module
 */
function loadModule (type) {
  return require(`./session-${type}`)
}

/**
 * Create a terminal session
 * @param {object} initOptions - Terminal initialization options
 * @param {object} ws - WebSocket connection
 * @returns {Promise} Terminal session
 */
exports.startSession = async function (initOptions, ws, func = 'session') {
  const type = initOptions.termType || initOptions.type || 'ssh'
  if (!['ssh', 'local', 'terminal'].includes(type)) {
    throw new Error('Only SSH and local terminals are supported')
  }
  const tail = type === 'local' ? 'local' : 'ssh'
  const module = loadModule(tail)
  return module[func](initOptions, ws)
}
