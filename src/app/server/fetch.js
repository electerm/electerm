/**
 * node fetch in server side
 */

const rp = require('phin')

module.exports = (options) => {
  return rp(options)
    .then((res) => {
      if (res.statusCode >= 304) {
        throw new Error(`status: ${res.statusCode}`)
      }
      return res.body.toString()
    })
    .catch(error => {
      return {
        error
      }
    })
}
