const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  replaceJSON,
  renameDist
} = require('./build-common')

async function main () {
  echo('running build for linux loong64')

  echo('build linux-loong64.tar.gz')
  renameDist()
  let src = 'linux-loong64.tar.gz'
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['tar.gz']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux-loong64.tar.gz:')
    console.error(error)
  })
  await uploadToR2(src)

  echo('build linux-loong64.deb')
  renameDist()
  src = 'linux-loong64.deb'
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['deb']
    }
  )
  await run(`${pb} --linux --loong64`).catch(error => {
    echo('❌ Fatal error in build linux-loong64.deb:')
    console.error(error)
  })
  await uploadToR2(src)
}

main()
