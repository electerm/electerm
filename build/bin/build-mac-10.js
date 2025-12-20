const { rm, echo } = require('shelljs')
const replace = require('replace-in-file')
const {
  run,
  writeSrc,
  builder
} = require('./build-common')

const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['${productName}-${version}-${os}-${arch}.${ext}'], // eslint-disable-line
  to: ['${productName}-${version}-${os}10-${arch}.${ext}'] // eslint-disable-line
}

function replaceRun () {
  return new Promise((resolve, reject) => {
    replace(options, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('start build mac10 file')
      resolve()
    })
  })
}

async function main () {
  const pb = builder
  echo('running build for mac10 (macOS 10.15 Catalina compatible)')

  echo('build dmg')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('mac10-x64.dmg')
  await run(`${pb} --mac --x64`)
}

main()
