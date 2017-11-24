const {exec} = require('child_process')
const os = require('os')
const isWin = os.platform() === 'win32'
const fs = require('fs')

/**
 * run cmd
 * @param {string} cmd
 */
const run = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else if (stderr) {
        reject(stderr)
      }
      resolve(stdout)
    })
  })
}

/**
 * rm -rf directory
 * @param {string} localFolderPath absolute path of directory
 */
const rmrf = (localFolderPath) => {
  let cmd = isWin
    ? `Remove-Item ${localFolderPath} -Force -Recurse -ErrorAction SilentlyContinue`
    : `rm -rf ${localFolderPath}`
  return run(cmd)
}

/**
 * rm -rf directory
 * @param {string} localFolderPath absolute path of directory
 */
const mv = (from, to) => {
  let cmd = isWin
    ? `Move-Item ${from} ${to}`
    : `mv ${from} ${to}`
  return run(cmd)
}

/**
 * touch file
 * @param {string} localFolderPath absolute path
 */
const touch = (localFilePath) => {
  let str = `touch ${localFilePath}`
  if (isWin) {
    str = `New-Item -ItemType file ${localFilePath}`
  }
  return new Promise((resolve, reject) => {
    exec(str, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else if (stderr) {
        reject(stderr)
      }
      resolve(stdout)
    })
  })
}

module.exports = Object.assign(
  Promise.promisifyAll(fs),
  {
    rmrf,
    touch,
    mv
  }
)
