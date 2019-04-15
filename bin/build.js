/**
 * build
 */

const {exec, echo} = require('shelljs')

echo('start build')

const timeStart = + new Date()

echo('clean')
exec('npm run clean')
exec('npm run ver')
exec('npm run build')

const endTime = +new Date()
echo(`done build in ${(endTime - timeStart)/1000} s`)
