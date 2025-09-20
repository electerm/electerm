const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild
} = require('./build-common')

async function main () {
  echo('running build for Windows ARM64')

  echo('build tar.gz for Windows ARM64')
  rm('-rf', 'dist')
  writeSrc('win-arm64.tar.gz')
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --win --arm64 tar.gz`)
}

main()
