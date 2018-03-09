/**
 * transfer class
 */


const fs = require('fs')
const _ = require('lodash')

class Transfer {

  constructor({
    remotePath,
    localPath,
    options = {},
    id,
    type = 'download',
    sftp,
    ws
  }) {
    this.id = id
    let readSteam = type === 'download'
      ? sftp.createReadStream(remotePath, options)
      : fs.createReadStream(localPath, options)
    let writeSteam = type === 'download'
      ? fs.createWriteStream(localPath, options)
      : sftp.createWriteStream(remotePath, options)

    let count = 0
    this.onData = _.throttle((count) => {
      ws.s({
        id: 'transfer:data:' + id,
        data: count
      })
    }, 1000)
    let th = this
    readSteam.on('data', chunk => {
      count += chunk.length
      writeSteam.write(chunk, () => {
        th.onData(count)
      })
    })

    readSteam.on('close', () => {
      writeSteam.end('', () => this.onEnd(id, ws))
    })

    readSteam.on('error', (err) => this.onError(err, id))

    // writeSteam.on('drain', () => {
    //   ///chunkcount --
    //   console.log('chunkcount', chunkcount)
    //   if (this.readEnd) {
    //     this.onEnd(id, ws)
    //   }
    // })

    this.readSteam = readSteam
    this.writeSteam = writeSteam
    this.ws = ws
  }

  onEnd (id, ws) {
    ws.s({
      id: 'transfer:end:' + id,
      data: null
    })
  }

  onError(err, id, ws) {
    ws.s({
      wid: 'transfer:err:' + id,
      error: {
        message: err.message,
        stack: err.stack
      }
    })
  }

  pause () {
    this.readSteam.pause()
  }

  resume () {
    this.readSteam.resume()
  }

  destroy () {
    this.readSteam.destroy()
    this.ws.close()
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
