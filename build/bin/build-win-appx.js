const { rm, echo } = require('shelljs')
const { resolve } = require('path')
const { upload } = require('./custom-upload')
const fs = require('fs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

async function main () {
  const pb = builder
  echo('build appx')
  const p = resolve(__dirname, '../../electron-builder.json')
  const txt = require('../../electron-builder.json')
  delete txt.electronLanguages
  fs.writeFileSync(p, JSON.stringify(txt, null, 2))
  rm('-rf', 'dist')
  writeSrc('win-x64.appx')
  await run(`${pb} --win appx`)
  await upload()
}

main()
