const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild
} = require('./build-common')

async function main () {
  echo('running build for mac arm')

  echo('build dmg')
  rm('-rf', 'dist')
  writeSrc('mac-arm64.dmg')
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --mac --arm64`)
}

main()
