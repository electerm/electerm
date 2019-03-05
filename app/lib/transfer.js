/**
 * transfer class
 */


const fs = require('original-fs')
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
      : fs.createReadStream(localPath, {
        ...options,
        highWaterMark: 64 * 1024 * 4 * 4
      })
    let writeSteam = type === 'download'
      ? fs.createWriteStream(localPath, options)
      : sftp.createWriteStream(remotePath, options)

    let count = 0

    this.pausing = false

    this.onData = _.throttle((count) => {
      ws.s({
        id: 'transfer:data:' + id,
        data: count
      })
    }, 1000)

    readSteam.on('data', chunk => {
      let res = writeSteam.write(chunk)
      if (res) {
        count += chunk.length
        this.onData(count)
      } else {
        readSteam.pause()
        writeSteam.once('drain', () => {
          count += chunk.length
          this.onData(count)
          if (!this.pausing) {
            readSteam.resume()
          }
        })
      }
    })

    readSteam.on('close', () => {
      writeSteam.end('', () => this.onEnd(id, ws))
    })

    readSteam.on('error', (err) => this.onError(err, id))

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
    ws && ws.s({
      wid: 'transfer:err:' + id,
      error: {
        message: err.message,
        stack: err.stack
      }
    })
  }

  pause () {
    this.pausing = true
    this.readSteam.pause()
  }

  resume () {
    this.pausing = false
    this.readSteam.resume()
  }

  destroy () {
    this.readSteam.destroy()
    this.ws.close()
    delete global.transferInsts[this.id]
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
