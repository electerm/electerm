const { exec } = require('shelljs')

const cmd = 'rm -rf dist && ' +
'./node_modules/.bin/electron-builder --mac --x64 && ' +
'./node_modules/.bin/electron-builder --mac --arm64'
exec(cmd)
