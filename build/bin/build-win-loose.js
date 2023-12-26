const replace = require('replace-in-file')
const { rm, echo } = require('shelljs')
const { upload } = require('./custom-upload')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')
const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['"asar": true', '${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['"asar": false', '${productName}-${version}-${os}-${arch}-loose.${ext}', ''] // eslint-disable-line
}

function replaceRun () {
  return new Promise((resolve, reject) => {
    replace(options, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('start build loose file(no asar)')
      resolve()
    })
  })
}

async function main () {
  const pb = builder
  echo('build loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win-x64-loose.tar.gz')
  await run(`${pb} --win tar.gz`)
  await upload()
}

main()
