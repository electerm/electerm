/**
 * post install script
 */
const {exec, cp} = require('shelljs')
const {existsSync} = require('fs')
const {resolve} = require('path')
const prePushPath = resolve(__dirname, '../.git/hooks/pre-push')
const prePushPathFrom = resolve(__dirname, 'pre-push')
exec('./node_modules/.bin/electron-rebuild')

if (!existsSync(prePushPath)) {
  cp(prePushPathFrom, prePushPath)
}
