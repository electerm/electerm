/**
 * common functions for build
 */

const { exec } = require('child_process')
const { resolve } = require('path')
const { writeFileSync, readFileSync } = require('fs')
const replace = require('replace-in-file')

exports.run = function (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, {
      env: { ...process.env, DEBUG: 'electron-builder:*' },
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (err, stdout, stderr) => {
      if (err) {
        console.error('Command failed:', cmd)
        console.error('Error:', err.message)
        console.error('Stderr:', stderr)
        return reject(err)
      }
      if (stderr) {
        console.log('Stderr output:', stderr)
      }
      resolve(stdout)
    })
  }).then(console.log).catch(console.error)
}

exports.writeSrc = function (src) {
  const p = resolve(__dirname, '../../work/app/lib/install-src.js')
  writeFileSync(p, `module.exports = '${src}'`)
}

exports.builder = resolve(
  __dirname, '../../node_modules/.bin/electron-builder'
)

exports.reBuild = resolve(
  __dirname, '../../node_modules/.bin/electron-rebuild'
)

exports.replaceArr = function (froms, tos) {
  const pth = resolve(__dirname, '../../electron-builder.json')
  console.log('electron-builder', pth)
  let str = readFileSync(pth, 'utf8')
  for (let i = 0; i < froms.length; i++) {
    str = str.replace(froms[i], tos[i])
  }
  writeFileSync(pth, str)
}

exports.changeTeamId = function () {
  exports.replaceArr(['__teamId'], [process.env.APPLE_TEAM_ID])
}

exports.replaceJSON = function (func) {
  const pth = resolve(__dirname, '../../electron-builder.json')
  const js = require(pth)
  func(js)
  writeFileSync(pth, JSON.stringify(js, null, 2))
}

const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['"asar": true', '${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['"asar": false', '${productName}-${version}-${os}-${arch}-loose.${ext}', ''] // eslint-disable-line
}

exports.replaceRun = function () {
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
