const { echo, rm, mv } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild,
  replaceJSON
} = require('./build-common')

const shouldKeepFile = !!process.env.KEEP_FILE

function renameDist () {
  if (!shouldKeepFile) {
    return rm('-rf', 'dist')
  }
  mv('dist', 'dist' + new Date().getTime())
}

async function main () {
  echo('running build for linux part 3 arm64/armv7l')

  echo('build linux.arm64.tar.gz')
  renameDist()
  writeSrc('linux-arm64.tar.gz')
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`)

  echo('build linux.arm64.deb')
  renameDist()
  writeSrc('linux-arm64.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.aarch64.rpm')
  renameDist()
  writeSrc('linux-aarch64.rpm')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.arm64.AppImage')
  renameDist()
  writeSrc('linux-arm64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`)

  echo('build linux.armv7l.tar.gz')
  renameDist()
  writeSrc('linux-armv7l.tar.gz')
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch armv7l -f work/app`)
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.deb')
  renameDist()
  writeSrc('linux-armv7l.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.rpm')
  renameDist()
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  writeSrc('linux-armv7l.rpm')
  await run(`${pb} --linux --armv7l`)

  echo('build linux.armv7l.AppImage')
  renameDist()
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  writeSrc('linux-armv7l.AppImage')
  await run(`${pb} --linux --armv7l`)
}

main()
