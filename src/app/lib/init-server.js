/**
 * server init script
 */

const createChildServer = require('../server/child-process')

module.exports = async (config, env, sysLocale) => {
  return new Promise((resolve) => {
    const child = createChildServer(config, env, sysLocale)
    child.on('exit', () => {
      global.childPid = null
    })
    global.childPid = child.pid
    child.on('message', (m) => {
      if (m && m.serverInited) {
        resolve(true)
      }
    })
  })
}
