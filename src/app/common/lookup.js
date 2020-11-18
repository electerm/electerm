/**
 * dns lookup
 */

module.exports = (host) => {
  return new Promise((resolve, reject) => {
    require('dns').lookup(host, function (err, result) {
      if (err) {
        return reject(err)
      }
      resolve(result)
    })
  })
}
