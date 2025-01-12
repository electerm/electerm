const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  builder: pb
} = require('./build-common')

async function main () {
  echo('running build for linux part 2')

  echo('build rpm')
  rm('-rf', 'dist')
  writeSrc('linux-x86_64.rpm')
  await run(`${pb} --linux rpm`)

  echo('build snap')
  rm('-rf', 'dist')
  writeSrc('linux-amd64.snap')
  await run(`${pb} --linux snap -p always`)
}

main()
