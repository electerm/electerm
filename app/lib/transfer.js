/**
 * transfer class
 */


const fs = require('fs')

class Transfer {

  constructor({
    remotePath,
    localPath,
    options = {},
    id,
    type = 'download',
    sftp
  }) {
    this.id = id
    let readSteam = type === 'download'
      ? sftp.createReadStream(remotePath, options)
      : fs.createReadStream(localPath, options)
    let writeSteam = type === 'download'
      ? fs.createWriteStream(localPath, options)
      : sftp.createWriteStream(remotePath, options)

    let count = 0
    let th = this
    readSteam.on('data', chunk => {
      count += chunk.length
      th.onData(count, id)
      writeSteam.write(chunk)
    })

    readSteam.on('close', () => this.onEnd(id))

    readSteam.on('error', (err) => this.onError(err, id))

    this.readSteam = readSteam
    this.writeSteam = writeSteam
  }

  onData (count, id) {
    require('./win').win.webContents.send('transfer:data:' + id, count)
  }

  onEnd (id) {
    require('./win').win.webContents.send('transfer:end:' + id, null)
  }

  onError(err, id) {
    require('./win').win.webContents.send('transfer:err:' + id, err.message)
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


module.exports = {
  Transfer,
  transferKeys: [
    'pause',
    'resume',
    'destroy'
  ]
}
