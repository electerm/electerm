const replace = require('replace-in-file')
const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')
const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['${productName}-${version}-${os}-${arch}-portable.${ext}', ''] // eslint-disable-line
}

function replaceRun () {
  return new Promise((resolve, reject) => {
    replace(options, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('start build portable file')
      resolve()
    })
  })
}

async function main () {
  const pb = builder
  echo('running build for win part 3')

  echo('build portable tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win-x64-portable.tar.gz')
  await run(`${pb} --win tar.gz`)
}

main()
