/**
 * download upgrade class
 */

const fs = require('fs')
const { resolve } = require('path')
const _ = require('lodash')
const rp = require('phin')
const { isWin, isMac } = require('../utils/constants')
const installSrc = require('../lib/install-src')
const os = require('os')
const tempDir = os.tmpdir()
const { fsExport } = require('../lib/fs')
const { openFile, rmrf } = fsExport

function getReleaseInfo (filter, releaseInfoUrl) {
  return rp({
    url: releaseInfoUrl,
    timeout: 15000
  })
    .then((res) => {
      return JSON.parse(res.body.toString())
        .release
        .assets
        .filter(filter)[0]
    })
}

class Upgrade {
  constructor (options) {
    this.options = options
  }

  async init () {
    const {
      id,
      ws
    } = this.options
    const releaseInfoUrl = 'https://electerm.html5beta.com/data/electerm-github-release.json?_=' + (+new Date())
    let filter = r => {
      return r.name.includes(installSrc) &&
        r.name.includes('linux')
    }
    if (isWin) {
      filter = r => /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz/.test(r.name)
    } else if (isMac) {
      filter = r => /\.dmg$/.test(r.name)
    }
    const releaseInfo = await getReleaseInfo(filter, releaseInfoUrl)
      .catch(this.onError)
    if (!releaseInfo) {
      return
    }
    const localPath = resolve(tempDir, releaseInfo.name)
    const remotePath = releaseInfo.browser_download_url
    await rmrf(localPath)
    const { size } = releaseInfo
    this.id = id
    this.localPath = localPath
    const readSteam = await rp({
      url: remotePath,
      followRedirects: true,
      stream: true
    })
    const writeSteam = fs.createWriteStream(localPath)

    let count = 0

    this.pausing = false

    this.onData = _.throttle((count) => {
      if (this.onDestroy) {
        return
      }

      ws.s({
        id: 'upgrade:data:' + id,
        data: Math.floor(count * 100 / size)
      })
    }, 1000)

    readSteam.on('data', chunk => {
      const res = writeSteam.write(chunk)
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
    this.destroy = this.destroy.bind(this)
  }

  onEnd (id, ws) {
    if (!this.onDestroy) {
      openFile(this.localPath)
      ws.s({
        id: 'transfer:end:' + id,
        data: null
      })
    }
  }

  onError (err, id, ws) {
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
    this.onDestroy = true
    this.readSteam && this.readSteam.destroy()
    this.ws && this.ws.close()
    delete global.upgradeInsts[this.id]
  }

  // end
}

module.exports = Upgrade
