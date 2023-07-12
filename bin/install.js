const { exec, echo, rm } = require('shelljs')
const {
  resolve
} = require('path')

const p = resolve(__dirname, '../' + 'build/iTerm2-Color-Schemes')
echo('install required modules')
echo('install iTerm2-Color-Schemes')
rm('-rf', p)
exec(`git clone --depth 1 https://github.com/mbadolato/iTerm2-Color-Schemes.git ${p}`)
echo('done install required modules')
