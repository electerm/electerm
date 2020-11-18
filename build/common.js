const pack = require('../package.json')
const version = pack.version

exports.version = version
exports.env = process.env.NODE_ENV
