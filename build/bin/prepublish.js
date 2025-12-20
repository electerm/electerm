const savedPackage = [
  'shelljs',
  'phin',
  'download'
]
const pack = require('../../package.json')
const fs = require('fs')
const { resolve } = require('path')

delete pack.devDependencies
pack.dependencies = savedPackage.reduce((prev, p) => {
  prev[p] = '*'
  return prev
}, {})
pack.scripts = {
  postinstall: 'node npm/install.js',
  postpublish: 'node bin/postpublish.js'
}
delete pack.langugeRepo
delete pack.privacyNoticeLink
delete pack.knownIssuesLink
delete pack.sponsorLink
delete pack.releases
delete pack.standard
const from = resolve(__dirname, '../../package.json')
const to = resolve(__dirname, '../../package-bak.json')
fs.copyFileSync(from, to)
fs.unlinkSync(from)
fs.writeFileSync(from, JSON.stringify(pack, null, 2))
