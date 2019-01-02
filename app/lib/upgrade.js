/**
 * upgrade module
 * download new version packed app
 */

const os = require('os')
const {resolve} = require('path')
const {exec, rm, mv} = require('shelljs')
const rp = require('phin').promisified
const download = require('download')
// const installSrc = require('./install-src')
// const {fsExport} = require('./fs')
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

async function runLinux(ver) {
  let target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-linux-x64`)
  let targetNew = resolve(__dirname, '../electerm')
  exec(`rm -rf ${target} ${targetNew}`)
  let releaseInfo = await getReleaseInfo(r => /linux-x64\.tar\.gz/.test(r.name))
  await down(releaseInfo.browser_download_url)
  exec(`mv ${target} ${targetNew}`)
  exec(`echo "npm" > ${targetNew}/resources/install-src.txt`)
  exec('electerm')
}

async function runMac() {
  let releaseInfo = await getReleaseInfo(r => /\.dmg$/.test(r.name))
  await down(releaseInfo.browser_download_url, false)
  //await down('http://192.168.0.67:7500/electerm-0.16.1-mac.dmg', false)
  let target = resolve(tempDir, releaseInfo.name)
  exec(`open ${target}`)
}

async function runWin(ver) {
  let target = resolve(tempDir, `electerm-${ver.replace('v', '')}-win-x64.tar.gz`)
  let targetNew = resolve(tempDir, 'electerm')
  rm('-rf', [
    target,
    targetNew
  ])
  let releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win\.tar\.gz/.test(r.name))
  await down(releaseInfo.browser_download_url, false)
  //await down('http://192.168.0.67:7500/electerm-0.16.1-win.tar.gz')
  await mv(target, targetNew)
  require('child_process').execFile(`${targetNew}\\electerm.exe`)
}

module.exports = function(version) {
  if (isWin) {
    runWin(version)
  } else if (isMac) {
    runMac(version)
  } else {
    runLinux(version)
  }
}
