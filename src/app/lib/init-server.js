/**
 * server init script
 */

const createChildServer = require('../server/child-process')
const rp = require('phin').promisified

/**
 * wait async
 */
function wait (time) {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}

async function waitUntilServerStart (url) {
  let serverStarted = false
  while (!serverStarted) {
    await wait(10)
    await rp({
      url,
      timeout: 100
    })
      .then(() => {
        serverStarted = true
      })
      .catch(() => null)
  }
}

module.exports = async (env, config) => {
  const child = await createChildServer(config, env)
  child.on('exit', () => {
    global.childPid = null
  })
  global.childPid = child.pid
  const childServerUrl = `http://${config.host}:${config.port}/run`
  await waitUntilServerStart(childServerUrl)
}
