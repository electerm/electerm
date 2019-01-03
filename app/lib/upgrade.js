/**
 * upgrade module
 * download new version packed app
 */

const os = require('os')
const {resolve} = require('path')
const rp = require('phin').promisified
const download = require('download')
const installSrc = require('./install-src')
const {fsExport} = require('./fs')
const {rmrf, run, openFile} = fsExport
const isWin = os.platform() === 'win32'
const isMac = os.platform() === 'darwin'
const tempDir = os.tmpdir()
const releaseInfoUrl = 'https://electerm.html5beta.com/data/electerm-github-release.json?_=' + (+new Date())

function down (url, extract = true) {
  console.log('dowmloading ' + url, tempDir)
  return download(url, tempDir, {extract}).then(() => {
    console.log('done!')
  })
}

function getReleaseInfo(filter) {
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

async function runLinux() {
  if (installSrc === 'npm') {
    return run('npm i -g electerm')
  }
  let releaseInfo = await getReleaseInfo(r => {
    return r.name.includes(installSrc) &&
      r.name.includes('linux')
  })
  await down(releaseInfo.browser_download_url)
  let target = resolve(tempDir, releaseInfo.name)
  await rmrf(target)
  await openFile(target)
}

async function runMac() {
  let releaseInfo = await getReleaseInfo(r => /\.dmg$/.test(r.name))
  await down(releaseInfo.browser_download_url, false)
  //await down('http://192.168.0.67:7500/electerm-0.16.1-mac.dmg', false)
  let target = resolve(tempDir, releaseInfo.name)
  await rmrf(target)
  await openFile(target)
}

async function runWin() {
  let releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win\.tar\.gz/.test(r.name))
  await down(releaseInfo.browser_download_url, false)
  //await down('http://192.168.0.67:7500/electerm-0.16.1-win.tar.gz')
  let {name} = releaseInfo
  let p = resolve(tempDir, name)
  await rmrf(p)
  await openFile(p)
}

module.exports = function(version) {
  if (isWin) {
    return runWin(version)
  } else if (isMac) {
    return runMac(version)
  } else {
    return runLinux(version)
  }
}
