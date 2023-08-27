const { exec, echo, rm } = require('shelljs')
const {
  resolve
} = require('path')
const os = require('os')

const platform = os.platform()
const isWin = platform === 'win32'

const p = resolve(__dirname, '../iTerm2-Color-Schemes')
const run = resolve(__dirname, 'cp-iterm')
echo('install required modules')
echo('install iTerm2-Color-Schemes')
rm('-rf', p)
if (isWin) {
  exec(`git clone --depth 1 https://github.com/mbadolato/iTerm2-Color-Schemes.git ${p}`)
} else {
  exec(run)
}
echo('done install required modules')
