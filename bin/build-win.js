const { exec } = require('shelljs')
const replace = require('replace-in-file')
const options = {
  files: require('path').resolve(__dirname, '../electron-builder.json'),
  from: ['"asar": true', '${productName}-${version}-${os}-${arch}.${ext}'], // eslint-disable-line
  to: ['"asar": false', '${productName}-${version}-${os}-${arch}-loose.${ext}'] // eslint-disable-line
}

const cmd = 'npm run output -w'
// 'echo "build arm64 mac" && ' +
// './node_modules/.bin/electron-rebuild --arch arm64 -f -p work/app && ' +
// './node_modules/.bin/electron-builder --mac --arm64'
// const cmd = './node_modules/.bin/electron-builder --mac'
exec(cmd)

replace(options, () => {
  console.log('start build loose file(no asar)')
  exec(cmd)
})
