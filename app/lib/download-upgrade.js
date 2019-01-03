/**
 * download upgrade class
 */


const fs = require('fs')
const _ = require('lodash')
const rp = require('phin')

class Upgrade {

  constructor(options) {
    this.options = options
  }

  async init() {
    let {
      remotePath,
      localPath,
      id,
      ws
    } = this.options
    this.id = id
    let readSteam = await rp({
      url: remotePath,
      followRedirects: true,
      stream: true
    })
    let writeSteam = fs.createWriteStream(localPath)

    let count = 0

    this.pausing = false

    this.onData = _.throttle((count) => {
      ws.s({
        id: 'upgrade:data:' + id,
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
      id: 'upgrade:end:' + id,
      data: null
    })
  }

  onError(err, id, ws) {
    ws.s({
      wid: 'upgrade:err:' + id,
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
  }

  //end
}

module.exports = Upgrade
