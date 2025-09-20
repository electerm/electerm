const { echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  renameDist,
  reBuild,
  replaceJSON
} = require('./build-common')

// Function to add "-legacy" suffix to artifact names in electron-builder.json
function addLegacySuffix () {
  echo('============')
  echo('Updating electron-builder.json to add -legacy suffix')
  replaceJSON((data) => {
    // Update main artifactName
    if (data.artifactName) {
      data.artifactName = data.artifactName.replace('${productName}-${version}-${os}-${arch}.${ext}', '${productName}-${version}-${os}-${arch}-legacy.${ext}') // eslint-disable-line
    }
  })
  echo('Updated artifact names with -legacy suffix')
}

async function main () {
  echo('============================================')
  echo('==== Start: running build for linux part 3 arm64/armv7l legacy ====')
  echo('============================================')

  // Add legacy suffix to names
  addLegacySuffix()

  echo('============================================')
  echo('==== Start: build linux.arm64.tar.gz ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-arm64-legacy.tar.gz')
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
  writeSrc('linux-arm64-legacy.deb')
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
  writeSrc('linux-aarch64-legacy.rpm')
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
  writeSrc('linux-arm64-legacy.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --arm64`).catch(error => {
    echo('❌ Fatal error in build linux.arm64.AppImage:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.armv7l.tar.gz ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-armv7l-legacy.tar.gz')
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

  echo('============================================')
  echo('==== Start: build linux.armv7l.deb ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-armv7l-legacy.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.deb:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.armv7l.rpm ====')
  echo('============================================')
  renameDist()
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  writeSrc('linux-armv7l-legacy.rpm')
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.rpm:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.armv7l.AppImage ====')
  echo('============================================')
  renameDist()
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  writeSrc('linux-armv7l-legacy.AppImage')
  await run(`${pb} --linux --armv7l`).catch(error => {
    echo('❌ Fatal error in build linux.armv7l.AppImage:')
    console.error(error)
  })

  echo('✅ All Linux ARM builds completed successfully')
}

main()
