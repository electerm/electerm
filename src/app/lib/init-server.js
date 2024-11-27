/**
 * server init script
 */

const createChildServer = require('../server/child-process')
const globalState = require('./glob-state')

module.exports = async (config, env, sysLocale) => {
  return new Promise((resolve) => {
    const child = createChildServer(config, env, sysLocale)
    child.on('exit', () => {
      globalState.set('childPid', null)
    })
    globalState.set('childPid', child.pid)
    child.on('message', (m) => {
      if (m && m.serverInited) {
        resolve(child)
      }
    })
  })
}
