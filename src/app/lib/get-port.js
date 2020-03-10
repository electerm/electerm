/**
 * get first free open port
 */

const fp = require('find-free-port')
const log = require('../utils/log')

function getPort () {
  return new Promise((resolve, reject) => {
    fp(3075, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      } else {
        resolve(freePort)
      }
    })
  })
}

module.exports = () => {
  return getPort()
    .catch(e => {
      log.error('failed to get free port')
      return 0
    })
}
