const {exec, cd} = require('shelljs')
const os = require('os')
const platform = os.platform()
console.log('platform:', platform)
cd('app')
exec('../node_modules/.bin/cross-env NODE_ENV=development ../node_modules/.bin/electron ./app')

