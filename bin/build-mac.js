const { exec } = require('shelljs')

const cmd = 'rm -rf dist && ' +
'echo "build x64 mac" && ' +
'./node_modules/.bin/electron-builder --mac --x64'
// 'echo "build arm64 mac" && ' +
// './node_modules/.bin/electron-rebuild --arch arm64 -f -p work/app && ' +
// './node_modules/.bin/electron-builder --mac --arm64'
// const cmd = './node_modules/.bin/electron-builder --mac'
exec(cmd)
