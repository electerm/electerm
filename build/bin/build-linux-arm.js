const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild,
  replaceJSON
} = require('./build-common')

async function main () {
  echo('running build for linux part 3 arm64/armv7l')

  echo('build linux.arm64.tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.tar.gz')
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`)

  echo('build linux.arm64.deb')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.aarch64.rpm')
  rm('-rf', 'dist')
  writeSrc('linux-aarch64.rpm')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.arm64.AppImage')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.armv7l.tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-armv7l.tar.gz')
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch armv7l -f work/app`)
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.deb')
  rm('-rf', 'dist')
  writeSrc('linux-armv7l.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.rpm')
  rm('-rf', 'dist')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  writeSrc('linux-armv7l.rpm')
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.AppImage')
  rm('-rf', 'dist')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  writeSrc('linux-armv7l.AppImage')
  await run(`${pb} --linux --armv7l`)
}

main()
