const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('running build for win part nsis installer')

  echo('build nsis')
  const src = 'win-x64-installer.exe'
  rm('-rf', 'dist')
  writeSrc(src)
  await run(`${pb} --win nsis`)
  await uploadToR2(src)
}

main()
