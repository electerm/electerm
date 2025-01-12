const { rm, echo } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder,
  replaceRun
} = require('./build-common')

async function main () {
  const pb = builder
  echo('build loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win-x64-loose.tar.gz')
  await run(`DEBUG=* ${pb} --win tar.gz`)
  await upload()
}

main()
