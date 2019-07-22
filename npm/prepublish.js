const savedPackage = [
  'shelljs',
  'phin',
  'download'
]
const pack = require('../package.json')
const fs = require('fs')
const { resolve } = require('path')
const { cp, rm } = require('shelljs')

delete pack.devDependencies
pack.dependencies = savedPackage.reduce((prev, p) => {
  prev[p] = '*'
  return prev
}, {})
pack.scripts = {
  postinstall: 'node npm/install.js',
  postpublish: 'node npm/postpublish.js'
}
const from = resolve(__dirname, '../package.json')
const to = resolve(__dirname, '../package-bak.json')
cp(from, to)
rm(from)
fs.writeFileSync(from, JSON.stringify(pack, null, 2))
