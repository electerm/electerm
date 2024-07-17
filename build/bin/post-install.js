/**
 * post install script
 */
const { cp, exec } = require('shelljs')
const { existsSync } = require('fs')
const { resolve } = require('path')
const prePushPath = resolve(__dirname, '../../.git/hooks/pre-push')
const prePushPathFrom = resolve(__dirname, 'pre-push')
const os = require('os')

const platform = os.platform()
const isWin = platform === 'win32'
// const rest = ''
if (isWin && process.env.CI) {
  exec('npm cache clear -f')
  exec('npm uninstall node-gyp -g')
  exec('npm install node-gyp -g')
}
// exec(resolve('./node_modules/.bin/electron-rebuild') + rest)

if (!existsSync(prePushPath)) {
  cp(prePushPathFrom, prePushPath)
}
