/**
 * read version
 */

const fs = require('fs')
const {resolve} = require('path')
let version = (+new Date()).toString()
let path = resolve(__dirname, '../version')

try {
  version = fs.readFileSync(path).toString()
} catch(e) {
  console.log('no version file created')
}

module.exports = version
