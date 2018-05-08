/**
 * output uid with os name prefix
 */

const {generate} = require('shortid')
const os = require('os').platform()

module.exports = () => {
  return os + '_' + generate()
}
