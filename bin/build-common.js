/**
 * common functions for build
 */

const { exec } = require('child_process')
const { resolve } = require('path')
const { writeFileSync, readFileSync } = require('fs')

exports.run = function (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err || stderr) {
        return reject(err || stderr)
      }
      resolve(stdout)
    })
  }).then(console.log).catch(console.error)
}

exports.writeSrc = function (src) {
  const p = resolve(__dirname, '../work/app/lib/install-src.js')
  writeFileSync(p, `module.exports = '${src}'`)
}

exports.builder = resolve(
  __dirname, '../node_modules/.bin/electron-builder'
)

exports.reBuild = resolve(
  __dirname, '../node_modules/.bin/electron-rebuild'
)

exports.changeTeamId = function () {
  const pth = resolve(__dirname, '../electron-builder.json')
  console.log('electron-builder', pth)
  const str = readFileSync(pth)
    .toString().replace('__teamId', process.env.APPLE_TEAM_ID)
  writeFileSync(pth, str)
}
