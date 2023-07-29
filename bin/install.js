const { exec, echo, rm } = require('shelljs')
const {
  resolve
} = require('path')

const p = resolve(__dirname, '../build/iTerm2-Color-Schemes')
const run = resolve(__dirname, 'cp-iterm')
echo('install required modules')
echo('install iTerm2-Color-Schemes')
rm('-rf', p)

exec(run)
echo('done install required modules')
