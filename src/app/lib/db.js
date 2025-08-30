/**
 * db loader
 */

try {
  module.exports = require('./sqlite')
} catch (error) {
  console.error('Failed to load SQLite module:', error)
  console.log('Falling back to NeDB')
  module.exports = require('./nedb')
}
