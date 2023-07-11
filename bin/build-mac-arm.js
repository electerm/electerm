
// const cmd = 'rm -rf dist && ' +
// 'echo "build x64 mac" && ' +
// './node_modules/.bin/electron-builder --mac --x64'
// 'echo "build arm64 mac" && ' +
// './node_modules/.bin/electron-rebuild --arch arm64 -f -p work/app && ' +
// './node_modules/.bin/electron-builder --mac --arm64'
// const cmd = './node_modules/.bin/electron-builder --mac'

const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  changeTeamId,
  reBuild
} = require('./build-common')

async function main () {
  echo('running build for mac arm')

  echo('build dmg')
  rm('-rf', 'dist')
  writeSrc('mac-arm64.dmg')
  changeTeamId()
  await run(`DEBUG=true ${reBuild} --arch arm64 -f work/app`)
  await run(`DEBUG=* ${pb} --mac --arm64`)
}

main()
