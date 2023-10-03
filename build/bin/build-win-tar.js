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
}

main()
