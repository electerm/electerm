/**
 * transfer class
 */

const  _ = require('lodash')
const fs = require('fs')

class Transfer {

  constructor({
    remotePath,
    localPath,
    options = {},
    onData = _.noop,
    onEnd = _.noop,
    onError = _.noop,
    type = 'download',
    sftp
  }) {

    let readSteam = type === 'download'
      ? sftp.createReadStream(remotePath, options)
      : fs.createReadStream(localPath, options)
    let writeSteam = type === 'download'
      ? fs.createWriteStream(localPath, options)
      : sftp.createWriteStream(remotePath, options)

    let count = 0

    readSteam.on('data', chunk => {
      count += chunk.length
      onData(count, chunk)
      writeSteam.write(chunk)
    })

    readSteam.on('close', onEnd)

    readSteam.on('error', onError)

    this.readSteam = readSteam
    this.writeSteam = writeSteam
  }

  pause () {
    this.readSteam.pause()
  }

  resume () {
    this.readSteam.resume()
  }

  destroy () {
    this.readSteam.destroy()
    this.writeSteam.destroy()
  }

  //end
}


module.exports = Transfer
