const cwd = process.cwd()
const pack = require(cwd + '/package.json')
const config = require(cwd + '/config.default.js')
const git = require('git-rev-sync')
let version = pack.version + '-' + git.long()

config.site.version = version

module.exports = exports.default = Object.freeze(config)
