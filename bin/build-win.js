
const replace = require('replace-in-file')
const { rm, echo } = require('shelljs')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')
const options = {
  files: require('path').resolve(__dirname, '../electron-builder.json'),
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
  echo('running build for win')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('win-x64.tar.gz')
  await run(`${pb} --win tar.gz`)

  echo('build appx')
  rm('-rf', 'dist')
  writeSrc('.appx')
  await run(`${pb} --win appx`)

  echo('build nsis')
  rm('-rf', 'dist')
  writeSrc('win-x64-installer.exe')
  await run(`${pb} --win nsis`)

  echo('build loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win-x64-loose.tar.gz')
  await run(`${pb} --win tar.gz`)
}

main()
