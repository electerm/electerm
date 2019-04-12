const {exec} = require('shelljs')
const os = require('os')
const platform = os.platform()
console.log('platform:', platform)
let cmd = platform.startsWith('win')
  ? '.\\node_modules\\.bin\\cross-env NODE_ENV=development .\\node_modules\\.bin\\electron .\\src\\electerm'
  : './node_modules/.bin/cross-env NODE_ENV=development ./node_modules/.bin/electron ./src/electerm'
exec(cmd)

