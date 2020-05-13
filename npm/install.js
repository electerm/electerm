/**
 * install electerm from binary
 */

const os = require('os')
const { resolve } = require('path')
const { exec, rm, mv } = require('shelljs')
const rp = require('phin').promisified
const download = require('download')
const isWin = os.platform() === 'win32'
const isMac = os.platform() === 'darwin'
const { homepage } = require('../package.json')
const releaseInfoUrl = `${homepage}/data/electerm-github-release.json?_=${+new Date()}`
const versionUrl = `${homepage}/version.html?_=${+new Date()}`

function down (url, extract = true) {
  const local = resolve(__dirname, '../')
  console.log('downloading ' + url)
  return download(url, local, { extract }).then(() => {
    console.log('done!')
  })
}

function getVer () {
  return rp({
    url: versionUrl,
    timeout: 15000
  })
    .then(res => res.body.toString())
}

function getReleaseInfo (filter) {
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

async function runLinux () {
  const ver = await getVer()
  const target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-linux-x64`)
  const targetNew = resolve(__dirname, '../electerm')
  exec(`rm -rf ${target} ${targetNew}`)
  const releaseInfo = await getReleaseInfo(r => /linux-x64\.tar\.gz/.test(r.name))
  await down(releaseInfo.browser_download_url)
  // await down('http://192.168.0.67:7500/electerm-0.16.1.tar.gz')
  exec(`mv ${target} ${targetNew}`)
  exec(`echo "npm" > ${targetNew}/resources/install-src.txt`)
  exec('electerm')
}

async function runMac () {
  const releaseInfo = await getReleaseInfo(r => /\.dmg$/.test(r.name))
  await down(releaseInfo.browser_download_url, false)
  // await down('http://192.168.0.67:7500/electerm-0.16.1-mac.dmg', false)
  const target = resolve(__dirname, '../', releaseInfo.name)
  exec(`open ${target}`)
}

async function runWin () {
  const ver = await getVer()
  const target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-win-x64`)
  const targetNew = resolve(__dirname, '../electerm')
  rm('-rf', [
    target,
    targetNew
  ])
  const releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz/.test(r.name))
  await down(releaseInfo.browser_download_url)
  // await down('http://192.168.0.67:7500/electerm-0.16.1-win.tar.gz')
  await mv(target, targetNew)
  require('child_process').execFile(`${targetNew}\\electerm.exe`)
}

if (isWin) {
  runWin()
} else if (isMac) {
  runMac()
} else {
  runLinux()
}
