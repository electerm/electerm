/**
 * get first free open port
 */

const log = require('../common/log')
const globalState = require('./glob-state')
const { getFreePort } = require('./free-port')
let port = null

async function getPort (fromPort = 30975) {
  const serverPort = globalState.get('serverPort')
  if (serverPort) {
    port = parseInt(serverPort, 10)
    return port
  }
  port = await getFreePort({ from: fromPort })
  return port
}

module.exports = () => {
  if (port) {
    return port
  }
  return getPort()
    .catch(e => {
      log.error('failed to get free port', e.message)
      throw e
    })
}
