/**
 * dns lookup
 */

import dns from 'dns'

export default (host) => {
  return new Promise((resolve, reject) => {
    dns.lookup(host, function(err, result) {
      if (err) {
        return reject(err)
      }
      resolve(result)
    })
  })
}
