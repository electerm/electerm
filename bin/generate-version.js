
// 写入版本号
const pack = require('../package.json')
const git = require('git-rev-sync')
const version = pack.version + '-' + git.long()
const { writeFileSync } = require('fs')
const { resolve } = require('path')
const path = resolve(__dirname, '../version')
writeFileSync(path, version)
