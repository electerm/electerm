/**
 * prepare the files to be packed
 */

const pack = require('../../package.json')
const os = require('os')
const { resolve } = require('path')
const { version } = pack
const { mkdir, rm, exec, echo, cp } = require('shelljs')
const dir = 'dist/v' + version
const cwd = process.cwd()

const platform = os.platform()
const isWin = platform === 'win32'

pack.main = 'app.js'
delete pack.scripts
delete pack.standard
delete pack.files
delete pack.engines
delete pack.preferGlobal

if (isWin) {
  delete pack.dependencies['node-bash']
} else {
  delete pack.dependencies['node-powershell']
}

echo('start pack prepare')
// echo('install test deps')
// exec(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D -E playwright@1.28.1 --no-save && npm i -D -E @playwright/test@1.28.1 --no-save`)
const timeStart = +new Date()
rm('-rf', dir)
rm('-rf', 'dist/latest')

mkdir('-p', dir)
mkdir('-p', 'dist/latest')
cp('-r', 'src/app', 'work/')
cp('-r', [
  'node_modules'
], 'work/app/')
rm('-rf', 'work/app/user-config.json')
rm('-rf', 'work/app/localstorage.json')
rm('-rf', 'work/app/nohup.out')
rm('-rf', 'work/app/assets/js/index*')
rm('-rf', 'work/app/assets/js/*.txt')
require('fs').writeFileSync(
  resolve(__dirname, '../../work/app/package.json'),
  JSON.stringify(
    pack, null, 2
  )
)

exec(`cd work/app && npm prune --production && cd ${cwd}`)

// yarn auto clean
cp('-r', 'build/bin/.yarnclean', 'work/app/')
exec(`cd work/app && yarn generate-lock-entry > yarn.lock && yarn autoclean --force && cd ${cwd}`)
rm('-rf', 'work/app/.yarnclean')
rm('-rf', 'work/app/package-lock.json')
rm('-rf', 'work/app/yarn.lock')

const endTime = +new Date()
echo(`done pack prepare in ${(endTime - timeStart) / 1000} s`)
