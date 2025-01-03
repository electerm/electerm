const { echo, rm, cp } = require('shelljs')
const path = require('path')
const {
  run,
  writeSrc,
  builder: pb,
  reBuild,
  replaceJSON
} = require('./build-common')

async function main () {
  const shouldKeepFile = !!process.env.KEEP_FILE
  const rootDir = path.resolve(__dirname, '..', '..')

  // Define the keep function with a single parameter using absolute paths
  const keep = (filename) => {
    if (shouldKeepFile) {
      const src = path.resolve(rootDir, 'dist', filename)
      const dest = path.resolve(rootDir, filename)
      cp(src, dest)
    }
  }

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
  keep('linux-arm64.tar.gz')

  echo('build linux.arm64.deb')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --arm64`)
  keep('linux-arm64.deb')

  echo('build linux.aarch64.rpm')
  rm('-rf', 'dist')
  writeSrc('linux-aarch64.rpm')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --arm64`)
  keep('linux-aarch64.rpm')

  echo('build linux.arm64.AppImage')
  rm('-rf', 'dist')
  writeSrc('linux-arm64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`)
  keep('linux-arm64.AppImage')

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
  keep('linux-armv7l.tar.gz')

  echo('build linux.armv7l.deb')
  rm('-rf', 'dist')
  writeSrc('linux-armv7l.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --armv7l`)
  keep('linux-armv7l.deb')

  echo('build linux.armv7l.rpm')
  rm('-rf', 'dist')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  writeSrc('linux-armv7l.rpm')
  await run(`${pb} --linux --armv7l`)
  keep('linux-armv7l.rpm')

  echo('build linux.armv7l.AppImage')
  rm('-rf', 'dist')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  writeSrc('linux-armv7l.AppImage')
  await run(`${pb} --linux --armv7l`)
  keep('linux-armv7l.AppImage')
}

main()
