const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('running build for win part 1')

  echo('build tar.gz')
  rm('-rf', 'dist')
  const src = 'win-x64.tar.gz'
  writeSrc(src)
  await run(`${pb} --win tar.gz`)
  await uploadToR2(src)
}

main()
