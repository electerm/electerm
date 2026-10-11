/**
 * build
 */

const { exec, echo } = require('shelljs')

echo('start build')

const timeStart = +new Date()

// echo('clean')
// exec('npm run clean')
echo('version file')
echo('js/css file')
exec('npm run vite-build')
echo('copy file')
exec('node ./src/build/bin/copy.js')
echo('html file')
exec('node ./src/build/bin/pug.js')

const endTime = +new Date()
echo(`done build in ${(endTime - timeStart) / 1000} s`)
