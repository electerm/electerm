// const cmd = 'rm -rf dist && ' +
// 'echo "build x64 mac" && ' +
// './node_modules/.bin/electron-builder --mac --x64'
// 'echo "build arm64 mac" && ' +
// './node_modules/.bin/electron-rebuild --arch arm64 -f -p work/app && ' +
// './node_modules/.bin/electron-builder --mac --arm64'
// const cmd = './node_modules/.bin/electron-builder --mac'

const { echo, rm } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder: pb,
  changeTeamId
} = require('./build-common')

async function main () {
  echo('running build for mac')

  echo('build dmg')
  changeTeamId()
  rm('-rf', 'dist')
  writeSrc('mac-x64.dmg')
  await run(`${pb} --mac`)
  await upload()
}

main()
