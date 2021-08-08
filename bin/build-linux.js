const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb
} = require('./build-common')

async function main () {
  echo('running build for linux')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('linux-x64.tar.gz')
  await run(`${pb} --linux tar.gz`)

  echo('build deb')
  rm('-rf', 'dist')
  writeSrc('.deb')
  await run(`${pb} --linux deb`)

  echo('build rpm')
  rm('-rf', 'dist')
  writeSrc('.rpm')
  await run(`${pb} --linux rpm`)

  echo('build snap')
  rm('-rf', 'dist')
  writeSrc('.snap')
  await run(`${pb} --linux snap -p always`)
}

main()
