/**
 * server init script
 */

const createChildServer = require('../server/child-process')
const globalState = require('./glob-state')

module.exports = async (config, env, sysLocale) => {
  return new Promise((resolve, reject) => {
    const child = createChildServer(config, env, sysLocale)
    const port = `${config.host}:${config.port}`
    let settled = false
    // only the first outcome counts: the caller must not wait forever when the
    // backend cannot bind its port (Windows reserved range, blocked by AV, ...)
    const fail = (msg) => {
      if (settled) {
        return
      }
      settled = true
      reject(new Error(msg))
    }
    child.on('exit', (code) => {
      globalState.set('childPid', null)
      fail(`local backend server exited before it was ready (code ${code}), port ${port}`)
    })
    globalState.set('childPid', child.pid)
    child.on('message', (m) => {
      if (!m || settled) {
        return
      }
      if (m.serverInited) {
        settled = true
        resolve(child)
      } else if (m.serverInited === false) {
        fail(`cannot listen on ${port}: ${m.error?.message || 'unknown error'}`)
      }
    })
  })
}
