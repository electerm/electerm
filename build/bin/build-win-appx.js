const { rm, echo } = require('shelljs')
const { resolve } = require('path')
const fs = require('fs')
const {
  run,
  writeSrc,
  uploadToR2,
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
  const src = 'win-x64.appx'
  writeSrc(src)
  await run(`${pb} --win appx`)
  await uploadToR2(src)
}

main()
