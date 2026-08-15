/**
 * output uid with os name prefix
 */

const { nanoid } = require('nanoid')
const os = require('os').platform()

module.exports = () => {
  return os + '_' + nanoid()
}
