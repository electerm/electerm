/**
 * some test may need only run in some os
 */

const os = require('os')
const platform = os.platform()

module.exports = (osName) => {
  return platform === osName
}
