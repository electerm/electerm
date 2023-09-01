/**
 * build
 */

const { exec, echo, mkdir } = require('shelljs')

echo('start build')

const timeStart = +new Date()

// echo('clean')
// exec('npm run clean')
mkdir('-p', 'work/app/assets/iTerm2-Color-Schemes')
echo('version file')
exec('npm run ver')
echo('js/css file')
exec('npm run vite-build')
echo('copy file')
exec('node ./build/bin/copy.js')
echo('html file')
exec('node ./build/bin/pug.js')

const endTime = +new Date()
echo(`done build in ${(endTime - timeStart) / 1000} s`)
