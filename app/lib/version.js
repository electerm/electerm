/**
 * read version
 */

const fs = require('fs')
let version = (+new Date()).toString()

try {
  version = fs.readFileSync('../version').toString()
} catch(e) {
  console.log('no version file created')
}

module.exports = version
