const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder,
  replaceRun
} = require('./build-common')

async function main () {
  const pb = builder
  echo('build loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  const src = 'win-x64-loose.tar.gz'
  writeSrc(src)
  await run(`${pb} --win tar.gz`)
  await uploadToR2(src)
}

main()
