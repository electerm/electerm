
const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('running build for win part 1')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('win-x64.tar.gz')
  await run(`${pb} --win tar.gz`)

  echo('build appx')
  rm('-rf', 'dist')
  writeSrc('.appx')
  await run(`${pb} --win appx`)
}

main()
