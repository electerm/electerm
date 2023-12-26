const { rm, echo } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('running build for win part nsis installer')

  echo('build nsis')
  rm('-rf', 'dist')
  writeSrc('win-x64-installer.exe')
  await run(`${pb} --win nsis`)
  await upload()
}

main()
