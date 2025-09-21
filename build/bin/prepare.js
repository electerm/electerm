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
rm('-rf', 'work/app/user-config.json')
rm('-rf', 'work/app/localstorage.json')
rm('-rf', 'work/app/nohup.out')
rm('-rf', 'work/app/assets/js/index*')
rm('-rf', 'work/app/assets/js/*.txt')
rm('-rf', 'node_modules/cpu-features')

require('fs').writeFileSync(
  resolve(__dirname, '../../work/app/package.json'),
  JSON.stringify(
    pack, null, 2
  )
)

exec(`cd work/app && npm i --omit=dev && cd ${cwd}`)
rm('-rf', 'work/app/node_modules/.bin')
rm('-rf', 'work/app/node_modules/stylus/bin')
rm('-rf', 'work/app/node_modules/node-gyp-build')
// Remove axios browser/ESM builds and unnecessary files (keep only lib/ and node CJS)
rm('-rf', 'work/app/node_modules/axios/dist/esm')
rm('-rf', 'work/app/node_modules/axios/dist/browser')
rm('-rf', 'work/app/node_modules/axios/dist/axios.js')
rm('-rf', 'work/app/node_modules/axios/dist/axios.min.js')
rm('-rf', 'work/app/node_modules/axios/dist/*.map')
rm('-rf', 'work/app/node_modules/axios/index.d.cts')

// Remove cpu-features after npm prune to prevent rebuild issues
rm('-rf', 'node_modules/cpu-features')
rm('-rf', 'work/app/node_modules/cpu-features')

// Clean up node-pty platform-specific files to reduce bundle size
if (isWin) {
  // On Windows, remove Unix-specific files
  rm('-rf', 'work/app/node_modules/node-pty/lib/unixTerminal.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/unixTerminal.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/unixTerminal.test.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/unixTerminal.test.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/build/pty.target.mk')
  rm('-rf', 'work/app/node_modules/node-pty/build/spawn-helper.target.mk')
  rm('-rf', 'work/app/node_modules/node-pty/build/binding.Makefile')
  rm('-rf', 'work/app/node_modules/node-pty/build/gyp-mac-tool')
} else {
  // On Linux/Mac, remove Windows-specific files
  rm('-rf', 'work/app/node_modules/node-pty/lib/conpty_console_list_agent.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/conpty_console_list_agent.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsConoutConnection.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsConoutConnection.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsPtyAgent.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsPtyAgent.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsPtyAgent.test.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsPtyAgent.test.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsTerminal.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsTerminal.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsTerminal.test.js')
  rm('-rf', 'work/app/node_modules/node-pty/lib/windowsTerminal.test.js.map')
  rm('-rf', 'work/app/node_modules/node-pty/deps/winpty')
}

// Remove all test files from node-pty to reduce bundle size
rm('-rf', 'work/app/node_modules/node-pty/lib/*.test.js')
rm('-rf', 'work/app/node_modules/node-pty/lib/*.test.js.map')
rm('-rf', 'work/app/node_modules/node-pty/lib/testUtils.test.js')
rm('-rf', 'work/app/node_modules/node-pty/lib/testUtils.test.js.map')

// yarn auto clean
cp('-r', 'build/bin/.yarnclean', 'work/app/')
exec(`cd work/app && yarn generate-lock-entry > yarn.lock && yarn autoclean --force && cd ${cwd}`)
rm('-rf', 'work/app/.yarnclean')
rm('-rf', 'work/app/package-lock.json')
rm('-rf', 'work/app/yarn.lock')
require('./clean-empty-folders').main()

const endTime = +new Date()
echo(`done pack prepare in ${(endTime - timeStart) / 1000} s`)
