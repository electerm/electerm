
const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('running build for win part nsis portable installer')

  echo('build nsis')
  rm('-rf', 'dist')
  writeSrc('win-x64-portable-installer.exe')
  await run(`${pb} --win nsis portable`)
}

main()
