/**
 * server init script
 */

const getConfig = require('./get-config')
const createChildServer = require('./server/child-process')
const rp = require('phin').promisified

async function waitUntilServerStart (url) {
  let serverStarted = false
  while (!serverStarted) {
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

module.exports = async () => {
  const config = await getConfig()
  const child = await createChildServer(config)
  child.on('exit', () => {
    global.childPid = null
  })
  global.childPid = child.pid
  const childServerUrl = `http://${config.host}:${config.port}/run`
  await waitUntilServerStart(childServerUrl)
  return config
}
