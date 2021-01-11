/**
 * download upgrade class
 */

const fs = require('fs')
const { resolve } = require('path')
const _ = require('lodash')
const rp = require('axios')
const { isWin, isMac, isArm, packInfo } = require('../utils/constants')
const getInstallSrc = require('../lib/install-src')
const os = require('os')
const { fsExport } = require('../lib/fs')
const SocksProxyAgent = require('socks-proxy-agent')
const HttpsProxyAgent = require('https-proxy-agent')
const { openFile, rmrf } = fsExport

function createAgent (proxy) {
  if (!proxy.enableGlobalProxy) {
    return undefined
  }
  const {
    proxyPort,
    proxyType,
    proxyIp,
    proxyUsername,
    proxyPassword
  } = proxy
  if (proxyType !== '0') {
    return new SocksProxyAgent({
      type: parseInt(proxyType, 10),
      port: proxyPort,
      host: proxyIp,
      password: proxyPassword,
      username: proxyUsername
    })
  } else {
    return new HttpsProxyAgent({
      port: proxyPort,
      host: proxyIp
    })
  }
}

function getReleaseInfo (filter, releaseInfoUrl, agent) {
  return rp({
    url: releaseInfoUrl,
    timeout: 15000,
    httpsAgent: agent
  })
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
      proxy
    } = this.options
    const agent = createAgent(proxy)
    const releaseInfoUrl = `${packInfo.homepage}/data/electerm-github-release.json?_=${+new Date()}`
    const installSrc = getInstallSrc()
    let filter = r => {
      return r.name.includes(installSrc) &&
        r.name.includes('linux')
    }
    if (isWin) {
      filter = r => /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz/.test(r.name)
    } else if (isArm) {
      filter = r => {
        return /arm64\.dmg$/.test(r.name)
      }
    } else if (isMac) {
      filter = r => {
        return /mac\.dmg$/.test(r.name)
      }
    }
    const releaseInfo = await getReleaseInfo(filter, releaseInfoUrl, agent)
      .catch(this.onError)
    if (!releaseInfo) {
      return
    }
    const tempDir = os.tmpdir()
    const localPath = resolve(tempDir, releaseInfo.name)
    const remotePath = releaseInfo.browser_download_url
    await rmrf(localPath)
    const { size } = releaseInfo
    this.id = id
    this.localPath = localPath
    const readSteam = await rp({
      url: remotePath,
      httpsAgent: agent,
      responseType: 'stream'
    }).then(r => r.data)
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
