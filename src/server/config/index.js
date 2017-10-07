const cwd = process.cwd()
const pack = require(cwd + '/package.json')
const config = require(cwd + '/config.default.js')
let version = pack.version + '-' + (+new Date())

config.site.version = version

module.exports = exports.default = Object.freeze(config)
