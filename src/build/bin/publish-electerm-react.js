const { rm, echo, cd, cp, exec } = require('shelljs')
const { resolve } = require('path')
const fs = require('fs')
const pack = require('../../../package.json')
const tpack = require('../web-app/package.json')
tpack.version = pack.version

const to = resolve(__dirname, '../web-app/')
const from = resolve(__dirname, '../../../src/client')

// (re)generate src/build/web-app/README.md from the root README.md
require('./gen-web-app-readme')

echo('start build electerm-react pack and publish')
fs.writeFileSync(resolve(to, 'package.json'), JSON.stringify(tpack, null, 2))
rm('-rf', resolve(to, 'client'))
cp('-r', from, to)
cd(to)
// Trusted publishing: no --token. npm authenticates via the GitHub OIDC token
// (requires permissions: id-token: write in the workflow). Call npm directly:
// @jsdevtools/npm-publish writes its own .npmrc with _authToken=${NODE_AUTH_TOKEN}
// and an empty token, so npm takes the token path, dies with ENEEDAUTH instead of
// doing the OIDC exchange, and the wrapper still reports "already published".
// `exec` exits non-zero on failure, so a real error now fails the job.
const res = exec('npm publish --access public --provenance')
if (res.code !== 0) {
  echo('publish failed')
  process.exit(res.code || 1)
}
