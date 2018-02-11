let savedPackage = [
  'shelljs',
  'phin',
  'download'
]
let pack = require('../package.json')
let fs = require('fs')
let {resolve} = require('path')
let {cp, rm} = require('shelljs')

delete pack.devDependencies
pack.dependencies = savedPackage.reduce((prev, p) => {
  prev[p] = '*'
  return prev
}, {})
pack.scripts = {
  postinstall: 'node npm/install.js',
  postpublish: 'node npm/postpublish.js'
}
let from = resolve(__dirname, '../package.json')
let to = resolve(__dirname, '../package-bak.json')
cp(from, to)
rm(from)
fs.writeFileSync(from, JSON.stringify(pack, null, 2))

