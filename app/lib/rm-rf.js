const {exec} = require('child_process')
const os = require('os')
const isWin = os.platform() === 'win32'

/**
 * rm -rf directory
 * @param {string} localFolderPath absolute path of directory
 */
module.exports = (localFolderPath) => {
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
