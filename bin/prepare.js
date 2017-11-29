/**
 * prepare the files to be packed
 */

const {version} = require('../package.json')
const {mkdir, rm, exec, echo, cp} = require('shelljs')
const dir = 'dist/v' + version
const cwd = process.cwd()
const os = require('os')
const isWin = os.platform() === 'win32'

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
  'package.json',
  'node_modules',
  'version'
], 'work/app/')
rm('-rf',  'work/app/config.js')
rm('-rf',  'work/app/user-config.json')
rm('-rf',  'work/app/localstorage.json')
rm('-rf',  'work/app/assets/js/common-css.bundle.js')

exec(`cd work/app && npm prune --production && cd ${cwd}`)
if (!isWin) {
  exec(`cd work/app && ../../node_modules/.bin/n-prune && cd ${cwd}`)
}

const endTime = +new Date()
echo(`done pack prepare in ${(endTime - timeStart)/1000} s`)
