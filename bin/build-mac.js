const { exec } = require('shelljs')

const cmd = 'rm -rf dist && ' +
'echo "mac" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --mac --x64 && ' +
'echo "mac-arm" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --mac --arm64'
exec(cmd)
