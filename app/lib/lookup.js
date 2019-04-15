/**
 * dns lookup
 */

const dns = require('dns')


module.exports = (host) => {
  return new Promise((resolve, reject) => {
    dns.lookup(host, function(err, result) {
      if (err) {
        return reject(err)
      }
      resolve(result)
    })
  })

}
