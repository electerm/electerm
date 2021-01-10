const { exec } = require('shelljs')

const cmd = './node_modules/.bin/electron-builder --mac'
exec(cmd)
