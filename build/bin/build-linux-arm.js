const { echo } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  renameDist,
  reBuild,
  replaceJSON
} = require('./build-common')

async function main () {
  echo('============================================')
  echo('==== Start: running build for linux part 3 arm64/armv7l ====')
  echo('============================================')

  echo('============================================')
  echo('==== Start: build linux.arm64.tar.gz ====')
  echo('============================================')
  let src = 'linux-arm64.tar.gz'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  // await run(`${reBuild} --arch arm64 -f work/app`)
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.tar.gz:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.arm64.deb ====')
  echo('============================================')
  src = 'linux-arm64.deb'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.deb:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.aarch64.rpm ====')
  echo('============================================')
  src = 'linux-aarch64.rpm'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.aarch64.rpm:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.arm64.AppImage ====')
  echo('============================================')
  src = 'linux-arm64.AppImage'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.AppImage:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.armv7l.tar.gz ====')
  echo('============================================')
  src = 'linux-armv7l.tar.gz'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${reBuild} --arch armv7l -f work/app`)
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.armv7l.deb ====')
  echo('============================================')
  src = 'linux-armv7l.deb'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.deb:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.armv7l.rpm ====')
  echo('============================================')
  src = 'linux-armv7l.rpm'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.rpm:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('============================================')
  echo('==== Start: build linux.armv7l.AppImage ====')
  echo('============================================')
  src = 'linux-armv7l.AppImage'
  renameDist()
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.AppImage:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('✅ All Linux ARM builds completed successfully')
}

main()
