/**
 * download upgrade class
 */

const fs = require('fs')
const { resolve } = require('path')
const _ = require('lodash')
const rp = require('axios')
const { packInfo, tempDir } = require('../common/runtime-constants')
const installSrc = require('../lib/install-src')
const { fsExport } = require('../lib/fs')
const { createProxyAgent } = require('../lib/proxy-agent')
const { openFile, rmrf } = fsExport
const log = require('../common/log')
const globalState = require('./global-state')

rp.defaults.proxy = false

function getUrl (url, mirror) {
  if (mirror === 'download-electerm') {
    // return `https://sciproxy.com/${url}`
    return url
  } else if (mirror === 'github') {
    return url
  } else {
    const arr = url.split('/')
    const len = arr.length
    return `https://master.dl.sourceforge.net/project/electerm.mirror/${arr[len - 2]}/${arr[len - 1]}?viasf=1`
  }
}

function getReleaseInfo (
  filter, releaseInfoUrl, agent
) {
  const conf = {
    url: releaseInfoUrl,
    timeout: 15000
  }
  if (agent) {
    conf.httpsAgent = agent
  }
  return rp(conf)
    .then((res) => {
      return res.data
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
      ws,
      proxy,
      mirror
    } = this.options
    const agent = createProxyAgent(proxy)
    const releaseInfoUrl = `${packInfo.homepage}/data/electerm-github-release.json?_=${+new Date()}`
    const filter = r => {
      return r.name.includes(installSrc)
    }
    // if (isWin) {
    //   filter = r => /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz/.test(r.name)
    // } else if (isArm) {
    //   filter = r => {
    //     return /arm64\.dmg$/.test(r.name)
    //   }
    // } else if (isMac) {
    //   filter = r => {
    //     return /mac\.dmg$/.test(r.name)
    //   }
    // }
    const releaseInfo = await getReleaseInfo(filter, releaseInfoUrl, agent)
      .catch(this.onError)
    if (!releaseInfo) {
      return
    }
    const localPath = resolve(tempDir, releaseInfo.name)
    const remotePath = getUrl(releaseInfo.browser_download_url, mirror)
    await rmrf(localPath).catch(log.error)
    const { size } = releaseInfo
    this.id = id
    this.localPath = localPath
    const readSteam = await rp({
      url: remotePath,
      httpsAgent: agent,
      responseType: 'stream'
    })
      .then(r => r.data)
      .catch(err => {
        this.onError(err, id, ws)
      })
    if (!readSteam) {
      return
    }
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

    readSteam.on('error', (err) => this.onError(err, id, ws))

    this.readSteam = readSteam
    this.writeSteam = writeSteam
    this.ws = ws
    this.destroy = this.destroy.bind(this)
  }

  onEnd (id, ws) {
    if (!this.onDestroy) {
      openFile(this.localPath)
      process.send({
        showFileInFolder: this.localPath
      })
      ws.s({
        id: 'transfer:end:' + id,
        data: this.dir
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
    globalState.removeUpgradeInst(this.id)
  }

  // end
}

exports.Upgrade = Upgrade
