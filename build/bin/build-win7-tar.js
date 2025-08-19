const { rm, echo } = require('shelljs')
const replace = require('replace-in-file')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')
const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['${productName}-${version}-${os}7.${ext}', ''] // eslint-disable-line
}
function replaceRun () {
  return new Promise((resolve, reject) => {
    replace(options, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('start build win7 file')
      resolve()
    })
  })
}

async function main () {
  const pb = builder
  echo('running build for win7')

  echo('build tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win7.tar.gz')
  await run(`${pb} --win tar.gz`)
}

main()
