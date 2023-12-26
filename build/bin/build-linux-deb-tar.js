const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb,
  addCustomUpload
} = require('./build-common')

async function main () {
  echo('running build for linux part 1')
  addCustomUpload()

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-x64.tar.gz')
  await run(`${pb} --linux tar.gz`)

  echo('build deb')
  rm('-rf', 'dist')
  writeSrc('.deb')
  await run(`${pb} --linux deb`)
}

main()
