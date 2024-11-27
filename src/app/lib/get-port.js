/**
 * get first free open port
 */

const log = require('../common/log')
const globalState = require('./glob-state')
let port = null

function getPort (fromPort = 30975) {
  const serverPort = globalState.get('serverPort')
  if (serverPort) {
    port = parseInt(serverPort, 10)
    return Promise.resolve(
      port
    )
  }
  return new Promise((resolve, reject) => {
    require('find-free-port')(fromPort, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        port = freePort
        resolve(freePort)
      }
    })
  })
}

module.exports = () => {
  if (port) {
    return port
  }
  return getPort()
    .catch(e => {
      log.error('failed to get free port')
      return 0
    })
}
