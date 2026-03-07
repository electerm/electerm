const { echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  renameDist,
  replaceJSON
} = require('./build-common')

async function main () {
  echo('============================================')
  echo('==== Start: running build for linux loong64 ====')
  echo('============================================')

  echo('============================================')
  echo('==== Start: build linux.loong64.tar.gz ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-loong64.tar.gz')
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux.loong64.tar.gz:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.loong64.deb ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-loong64.deb')
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux.loong64.deb:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.loong64.rpm ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-loong64.rpm')
  replaceJSON(
    (data) => {
      data.linux.target = ['rpm']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux.loong64.rpm:')
    console.error(error)
  })

  echo('============================================')
  echo('==== Start: build linux.loong64.AppImage ====')
  echo('============================================')
  renameDist()
  writeSrc('linux-loong64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux.loong64.AppImage:')
    console.error(error)
  })
}

main()
