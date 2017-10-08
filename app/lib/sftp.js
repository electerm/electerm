/**
 * extend ssh2-sftp-client
 */
const fs = require('fs')
const Ftp = require('ssh2-sftp-client')

Ftp.prototype.getFile = function(remotePath, localPath, useCompression, encoding) {
  let options = this.getOptions(useCompression, encoding)
  return new Promise((resolve, reject) => {
    let sftp = this.sftp
    let streamRead = sftp.createReadStream(remotePath, options)
    let streamWrite = fs.createWriteStream(localPath, options)
    streamRead.on('data', data => {
      streamWrite.write(data)
    })
    streamRead.on('close', () => {
      streamWrite.close()
      resolve()
    })
    streamRead.on('error', err => {
      reject(err)
    })
  })
}

module.exports = Ftp
