const { echo, rm } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder: pb,
  replaceJSON
} = require('./build-common')

async function main () {
  echo('running build for linux part 1')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-x64.tar.gz')
  await run(`${pb} --linux tar.gz`)
  await upload()

  echo('build deb')
  rm('-rf', 'dist')
  writeSrc('.deb')
  await run(`${pb} --linux deb`)
  await upload()

  echo('build linux-x86_64.AppImage')
  rm('-rf', 'dist')
  writeSrc('linux-x86_64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux`)
}

main()
