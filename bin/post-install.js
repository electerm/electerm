/**
 * post install script
 */
const { cp, exec } = require('shelljs')
const { existsSync } = require('fs')
const { resolve } = require('path')
const prePushPath = resolve(__dirname, '../.git/hooks/pre-push')
const prePushPathFrom = resolve(__dirname, 'pre-push')
// const os = require('os')

// const platform = os.platform()
// const isWin = platform === 'win32'
const rest = ''

exec(resolve('./node_modules/.bin/electron-rebuild') + rest)

if (!existsSync(prePushPath)) {
  cp(prePushPathFrom, prePushPath)
}
