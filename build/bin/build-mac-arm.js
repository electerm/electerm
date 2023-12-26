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
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --mac --arm64`)
}

main()
