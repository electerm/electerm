/**
 * server init script
 */

const getConfig = require('./get-config')
const createChildServer = require('../server/child-process')
const rp = require('phin').promisified
const { initLang } = require('./locales')
const { saveUserConfig } = require('./user-config-controller')

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
  const { config, userConfig } = await getConfig()
  const language = initLang(userConfig)
  if (!config.language) {
    await saveUserConfig({
      language
    })
    config.language = language
  }
  const child = await createChildServer(config)
  child.on('exit', () => {
    global.childPid = null
  })
  global.childPid = child.pid
  const childServerUrl = `http://${config.host}:${config.port}/run`
  await waitUntilServerStart(childServerUrl)
  return {
    config,
    localeRef: require('./locales')
  }
}
