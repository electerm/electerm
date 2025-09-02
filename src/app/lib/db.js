/**
 * db loader
 */
if (process.versions.node < '22.0.0') {
  module.exports = require('./nedb')
} else {
  module.exports = require('./sqlite')
}
