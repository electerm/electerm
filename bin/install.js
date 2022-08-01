const { exec, echo, rm } = require('shelljs')
const {
  resolve
} = require('path')

const p = resolve(__dirname, '../' + 'build/iTerm2-Color-Schemes')
echo('install required modules')
echo('install playwright')
exec('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright@1.20.2 --no-save')
echo('install iTerm2-Color-Schemes')
rm('-rf', p)
exec(`git clone --depth=1 https://github.com/mbadolato/iTerm2-Color-Schemes.git ${p}`)
echo('done install required modules')
