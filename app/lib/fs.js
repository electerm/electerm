const {exec} = require('child_process')
const os = require('os')
const isWin = os.platform() === 'win32'
const fs = require('fs')

/**
 * rm -rf directory
 * @param {string} localFolderPath absolute path of directory
 */
const rmrf = (localFolderPath) => {
  let str = `rm -rf ${localFolderPath}`
  if (isWin) {
    str = `Remove-Item ${localFolderPath} -Force -Recurse -ErrorAction SilentlyContinue`
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
    touch
  }
)
