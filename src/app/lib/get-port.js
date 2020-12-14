/**
 * get first free open port
 */

const log = require('../utils/log')

let port = null

function getPort () {
  return new Promise((resolve, reject) => {
    require('find-free-port')(30975, '127.0.0.1', function (err, freePort) {
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
