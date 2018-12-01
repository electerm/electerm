const {exec} = require('shelljs')
const os = require('os')
const platform = os.platform()

let cmd = `cd app && ../node_modules/.bin/cross-env NODE_ENV=development ${platform.startsWith('win') ? '' : 'nohup'} ../node_modules/.bin/electron ./app`
exec(cmd)

