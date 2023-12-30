const { echo, rm } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild
} = require('./build-common')

async function main () {
  echo('running build for linux part 3 arm64')

  echo('build linux.arm64.deb')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.deb')
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`)
  await upload()

  // echo('build deb')
  // rm('-rf', 'dist')
  // writeSrc('.deb')
  // await run(`${pb} --linux --arm64 deb`)
  // await upload()
}

main()
