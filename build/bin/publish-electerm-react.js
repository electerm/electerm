const { rm, echo, cd, cp, exec } = require('shelljs')
const { resolve } = require('path')
const fs = require('fs')
const pack = require('../../package.json')
const tpack = require('../web-app/package.json')
tpack.version = pack.version

const to = resolve(__dirname, '../web-app/')
const from = resolve(__dirname, '../../src/client')

echo('start build electerm-react pack and publish')
fs.writeFileSync(resolve(to, 'package.json'), JSON.stringify(tpack, null, 2))
rm('-rf', resolve(to, 'client'))
cp('-r', from, to)
cd(to)
exec(`npm-publish  --token ${process.env.token} --access public`)
