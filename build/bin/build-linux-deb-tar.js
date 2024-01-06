const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  replaceRun,
  replaceJSON
} = require('./build-common')
const { upload } = require('./custom-upload')

async function main () {
  echo('running build for linux part 1')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-x64.tar.gz')
  await run(`${pb} --linux tar.gz`)

  echo('build deb')
  rm('-rf', 'dist')
  writeSrc('linux-x64.deb')
  await run(`${pb} --linux deb`)

  echo('build linux-x86_64.AppImage')
  rm('-rf', 'dist')
  writeSrc('linux-x86_64.AppImage')
  replaceJSON(
    (data) => {
      data.linux.target = ['AppImage']
    }
  )
  await run(`${pb} --linux`)

  echo('build linux loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('linux-x64-loose.tar.gz')
  await run(`${pb} --linux tar.gz`)
  await upload()
}

main()
