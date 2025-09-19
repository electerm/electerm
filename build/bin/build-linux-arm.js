const { echo, rm, mv } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  // reBuild,
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
  echo('============================================')
  echo('==== Start: running build for linux part 3 arm64/armv7l ====')
  echo('============================================')

  echo('============================================')
  echo('==== Start: build linux.arm64.tar.gz ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-arm64.tar.gz')
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

  echo('============================================')
  echo('==== Start: build linux.arm64.deb ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-arm64.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.deb:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.aarch64.rpm ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-aarch64.rpm')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.aarch64.rpm:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.arm64.AppImage ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-arm64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.AppImage:')
    console.error(error)
  })

  // echo('============================================')
  // echo('==== Start: build linux.armv7l.tar.gz ====')
  // echo('============================================')
  // renameDist()
  // writeSrc('linux-armv7l.tar.gz')
  // replaceJSON(
  //   (data) => {
  //     data.linux.target = ['tar.gz']
  //   }
  // )
  // await run(`${reBuild} --arch armv7l -f work/app`)
  // await run(`${pb} --linux --armv7l`).catch(error => {
  //   echo('❌ Fatal error in build linux.armv7l:')
  //   console.error(error)
  // })

  // echo('============================================')
  // echo('==== Start: build linux.armv7l.deb ====')
  // echo('============================================')
  // renameDist()
  // writeSrc('linux-armv7l.deb')
  // replaceJSON(
  //   (data) => {
  //     data.linux.target = ['deb']
  //   }
  // )
  // await run(`${pb} --linux --armv7l`).catch(error => {
  //   echo('❌ Fatal error in build linux.armv7l.deb:')
  //   console.error(error)
  // })

  // echo('============================================')
  // echo('==== Start: build linux.armv7l.rpm ====')
  // echo('============================================')
  // renameDist()
  // replaceJSON(
  //   (data) => {
  //     data.linux.target = ['rpm']
  //   }
  // )
  // writeSrc('linux-armv7l.rpm')
  // await run(`${pb} --linux --armv7l`).catch(error => {
  //   echo('❌ Fatal error in build linux.armv7l.rpm:')
  //   console.error(error)
  // })

  // echo('============================================')
  // echo('==== Start: build linux.armv7l.AppImage ====')
  // echo('============================================')
  // renameDist()
  // replaceJSON(
  //   (data) => {
  //     data.linux.target = ['AppImage']
  //   }
  // )
  // writeSrc('linux-armv7l.AppImage')
  // await run(`${pb} --linux --armv7l`).catch(error => {
  //   echo('❌ Fatal error in build linux.armv7l.AppImage:')
  //   console.error(error)
  // })

  echo('✅ All Linux ARM builds completed successfully')
}

main()
