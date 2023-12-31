const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild,
  replaceArr
} = require('./build-common')

async function main () {
  echo('running build for linux part 3 arm64/armv7l')

  echo('build linux.arm64.tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.tar.gz')
  replaceArr(
    [
      '  "tar.gz",',
      '"snap"'
    ],
    [
      '  "tar.gz"', ''
    ]
  )
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`)

  echo('build linux.arm64.tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.tar.gz')
  replaceArr(
    [
      '  "tar.gz",',
      '"snap"'
    ],
    [
      '  "tar.gz"', ''
    ]
  )
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`)
}

main()
