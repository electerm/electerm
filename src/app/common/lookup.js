/**
 * dns lookup
 */

module.exports = (host) => {
  const dns = require('dns')
  const v4 = new Promise((resolve, reject) => {
    dns.resolve4(host, function (err, result) {
      if (err) {
        console.log(`v4 dns lookup error: ${err.message}`)
        return resolve([])
      }
      resolve(result)
    })
  })
  const v6 = new Promise((resolve, reject) => {
    dns.resolve6(host, function (err, result) {
      if (err) {
        console.log(`v6 dns lookup error: ${err.message}`)
        return resolve([])
      }
      resolve(result)
    })
  })
  return Promise.all([v4, v6]).then(result => {
    return [...result[0], ...result[1]]
  })
}
