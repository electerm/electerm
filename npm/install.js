/**
 * install electerm from binary
 */

const os = require('os')
const {resolve} = require('path')
const {exec} = require('shelljs')
const pack = require('../package.json')
const rp = require('phin').promisified
const download = require('download')
const isWin = os.platform() === 'win32'
const isMac = os.platform() === 'darwin'
const releaseInfoUrl = 'https://raw.githubusercontent.com/electerm/electerm.html5beta.com/gh-pages/data/electerm-github-release.json'

//todo support mac/windows install
if (isMac || isWin) {
  console.log('install from npm do not support windows or mac os yet, you can visit http://electerm.html5beta.com to download it')
  process.exit(0)
}

function down (url) {
  let local = resolve(__dirname, '../')
  console.log('dowmloading ' + url)
  return download(url, local, {extract: true}).then(() => {
    console.log('done!')
  })
}

async function run() {
  let releaseInfo = await rp({
    url: releaseInfoUrl,
    timeout: 15000
  })
    .then((res) => {
      return JSON.parse(res.body.toString())
        .release
        .assets
        .filter(r => /electerm-\d+\.\d+\.\d+\.tar\.gz/.test(r.name))[0]
    })
  //await down(releaseInfo.browser_download_url)
  await down('http://192.168.0.67:7500/electerm-0.16.1.tar.gz')
  let target = resolve(__dirname, `../electerm-${pack.version}-linux-x64`)
  let targetNew = resolve(__dirname, '../electerm')
  let str = `mv ${target} ${targetNew}`
  console.log(str)
  exec(str)
}

run()
