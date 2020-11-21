
// version number creator
const pack = require('../package.json')
const { version } = pack
const { writeFileSync } = require('fs')
const { resolve } = require('path')
const path = resolve(__dirname, '../work/app/version')
writeFileSync(path, version)
