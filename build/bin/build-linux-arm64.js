const { echo, rm } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder: pb
} = require('./build-common')

async function main () {
  echo('running build for linux part 3 arm64')

  echo('build arm64-tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.tar.gz')
  await run(`${pb} --arm64 tar.gz`)
  await upload()

  // echo('build deb')
  // rm('-rf', 'dist')
  // writeSrc('.deb')
  // await run(`${pb} --linux --arm64 deb`)
  // await upload()
}

main()
