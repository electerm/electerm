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
  echo('running build for linux part 1')

  echo('build tar.gz')
  rm('-rf', 'dist')
  let src = 'linux-x64.tar.gz'
  writeSrc(src)
  await run(`${pb} --linux tar.gz`)
  await uploadToR2(src)
  renameDist()

  echo('build deb')
  rm('-rf', 'dist')
  src = 'linux-amd64.deb'
  writeSrc(src)
  await run(`${pb} --linux deb`)
  await uploadToR2(src)
  renameDist()

  echo('build linux-x86_64.AppImage')
  rm('-rf', 'dist')
  src = 'linux-x86_64.AppImage'
  writeSrc(src)
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux`)
  await uploadToR2(src)
  renameDist()
}

main()
