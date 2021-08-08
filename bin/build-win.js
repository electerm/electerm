const { exec } = require('child_process')
const replace = require('replace-in-file')
const { writeFileSync } = require('fs')
const { rm, echo } = require('shelljs')
const { resolve } = require('path')
const options = {
  files: require('path').resolve(__dirname, '../electron-builder.json'),
  from: ['"asar": true', '${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['"asar": false', '${productName}-${version}-${os}-${arch}-loose.${ext}', ''] // eslint-disable-line
}

function run (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err || stderr) {
        return reject(err || stderr)
      }
      resolve(stdout)
    })
  })
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

function writeSrc (src) {
  const p = resolve(__dirname, '../work/app/install-src.txt')
  writeFileSync(p, src)
}

async function main () {
  echo('running build for win')

  echo('build tar.gz')
  rm('-rf', 'dist')
  writeSrc('win-tar.gz')
  await run('./node_modules/.bin/electron-builder --win tar.gz')

  echo('build appx')
  rm('-rf', 'dist')
  writeSrc('appx')
  await run('./node_modules/.bin/electron-builder --win appx')

  echo('build nsis')
  rm('-rf', 'dist')
  writeSrc('nsis')
  await run('./node_modules/.bin/electron-builder --win nsis')

  echo('build loose tar.gz')
  await replaceRun()
  rm('-rf', 'dist')
  writeSrc('win.loose-tar.gz')
  await run('./node_modules/.bin/electron-builder --win tar.gz')
}

main()
