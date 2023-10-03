const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('build appx')
  rm('-rf', 'dist')
  writeSrc('.appx')
  await run(`${pb} --win appx`)
}

main()
