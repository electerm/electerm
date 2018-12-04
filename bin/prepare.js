/**
 * prepare the files to be packed
 */

let pack = require('../package.json')
const {resolve} = require('path')
const {version} = pack
const {mkdir, rm, exec, echo, cp} = require('shelljs')
const dir = 'dist/v' + version
const cwd = process.cwd()
pack.main = 'app.js'
delete pack.scripts
pack.devDependencies = {}
echo('start pack prepare')

const timeStart = + new Date()

rm('-rf', dir)
rm('-rf', 'dist/latest')
rm('-rf', 'work')

mkdir('-p', dir)
mkdir('-p', 'dist/latest')
mkdir('-p', 'work')
cp('-r', 'app', 'work/')
cp('-r', [
  'node_modules',
  'version'
], 'work/app/')
rm('-rf',  'work/app/dev-app.js')
rm('-rf',  'work/app/user-config.json')
rm('-rf',  'work/app/localstorage.json')
rm('-rf',  'work/app/nohup.out')
rm('-rf',  'work/app/assets/js/basic.bundle.js')
rm('-rf',  'work/app/assets/js/index.bundle.js')
require('fs').writeFileSync(
  resolve(__dirname, '../work/app/package.json'),
  JSON.stringify(
    pack, null, 2
  )
)

exec(`cd work/app && npm prune --production && cd ${cwd}`)

//yarn auto clean
cp('-r', 'bin/.yarnclean', 'work/app/')
exec(`cd work/app && yarn generate-lock-entry > yarn.lock && yarn autoclean --force && cd ${cwd}`)
rm('-rf',  'work/app/.yarnclean')
rm('-rf',  'work/app/package-lock.json')
rm('-rf',  'work/app/yarn.lock')

const endTime = +new Date()
echo(`done pack prepare in ${(endTime - timeStart)/1000} s`)
