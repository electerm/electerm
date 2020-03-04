const { exec } = require('shelljs')
const os = require('os')
const platform = os.platform()
console.log('platform:', platform)
const cmd = platform.startsWith('win')
  ? 'node_modules\\.bin\\cross-env NODE_ENV=development node_modules\\.bin\\electron  -r dotenv/config src\\app\\app'
  : 'node_modules/.bin/cross-env NODE_ENV=development node_modules/.bin/electron -r dotenv/config src/app/app'
exec(cmd)
