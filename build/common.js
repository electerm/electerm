const pack = require('../package.json')
const git = require('git-rev-sync')
const version = pack.version + '-' + git.long()

exports.version = version
exports.env = process.env.NODE_ENV
