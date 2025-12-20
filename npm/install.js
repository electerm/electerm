/**
 * install electerm from binary
 */

const os = require('os')
const { resolve } = require('path')
const { exec, rm, mv } = require('shelljs')
const rp = require('phin').promisified
const download = require('download')
const plat = os.platform()
const arch = os.arch()
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

function showFinalMessage () {
  console.log('\n========================================')
  console.log('electerm installation complete!')
  console.log('========================================')
  console.log('\nFor more information, documentation, and updates, please visit:')
  console.log('\x1b[36m%s\x1b[0m', 'https://electerm.html5beta.com')
  console.log('\nThank you for using electerm!')
  console.log('========================================\n')
}

// Check if running on Windows 7 or earlier
function isWindows7OrEarlier (platform, release) {
  if (platform !== 'win32') return false
  // Windows 7 is NT 6.1, Windows 8 is NT 6.2, Windows 10 is NT 10.0
  const [major, minor] = release.split('.').map(Number)
  return major < 10 && (major < 6 || (major === 6 && minor <= 1))
}

// Check if running on macOS 10.x (older than Big Sur 11.0)
function isMacOS10 (platform, release) {
  if (platform !== 'darwin') return false
  // Darwin kernel version: macOS 11 (Big Sur) = Darwin 20.x, macOS 10.15 = Darwin 19.x
  const majorVersion = parseInt(release.split('.')[0], 10)
  return majorVersion < 20
}

// Check if running on Linux with old glibc (< 2.34)
function isLinuxLegacy (platform, glibcVersion) {
  if (platform !== 'linux') return false
  if (typeof glibcVersion === 'number') {
    return glibcVersion < 2.34
  }
  try {
    const result = exec('ldd --version 2>&1 | head -n1', { silent: true })
    if (result.code !== 0) return false
    const output = result.stdout || ''
    // Extract version number like "ldd (GNU libc) 2.31" or "ldd (Ubuntu GLIBC 2.35-0ubuntu3) 2.35"
    const match = output.match(/(\d+\.\d+)\s*$/)
    if (match) {
      const version = parseFloat(match[1])
      return version < 2.34
    }
    return false
  } catch (e) {
    return false
  }
}

// Get the file pattern for download based on platform/arch/legacy status
function getDownloadPattern (platform, architecture, options = {}) {
  const { win7, mac10, linuxLegacy } = options

  if (platform === 'win32') {
    if (win7) {
      return { pattern: /electerm-\d+\.\d+\.\d+-win7\.tar\.gz$/, type: 'win7' }
    } else if (architecture === 'arm64') {
      return { pattern: /electerm-\d+\.\d+\.\d+-win-arm64\.tar\.gz$/, type: 'win-arm64' }
    } else {
      return { pattern: /electerm-\d+\.\d+\.\d+-win-x64\.tar\.gz$/, type: 'win-x64' }
    }
  } else if (platform === 'darwin') {
    if (mac10) {
      return { pattern: /mac10-x64\.dmg$/, type: 'mac10-x64' }
    } else if (architecture === 'arm64') {
      return { pattern: /mac-arm64\.dmg$/, type: 'mac-arm64' }
    } else {
      return { pattern: /mac-x64\.dmg$/, type: 'mac-x64' }
    }
  } else if (platform === 'linux') {
    const suffix = linuxLegacy ? '-legacy' : ''
    if (architecture === 'arm64') {
      return { pattern: new RegExp(`linux-arm64${suffix}\\.tar\\.gz$`), type: `linux-arm64${suffix}` }
    } else if (architecture === 'arm') {
      return { pattern: new RegExp(`linux-armv7l${suffix}\\.tar\\.gz$`), type: `linux-armv7l${suffix}` }
    } else {
      return { pattern: new RegExp(`linux-x64${suffix}\\.tar\\.gz$`), type: `linux-x64${suffix}` }
    }
  }
  return { pattern: null, type: 'unsupported' }
}

async function runLinux (folderName, filePattern) {
  const ver = await getVer()
  const target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-${folderName}`)
  const targetNew = resolve(__dirname, '../electerm')
  exec(`rm -rf ${target} ${targetNew}`)
  const releaseInfo = await getReleaseInfo(r => r.name.includes(filePattern))
  if (!releaseInfo) {
    throw new Error(`No release found for pattern: ${filePattern}`)
  }
  await down(releaseInfo.browser_download_url)
  exec(`mv ${target} ${targetNew}`)
  showFinalMessage()
  exec('electerm')
}

async function runMac (archName) {
  const pattern = new RegExp(`mac-${archName}\\.dmg$`)
  const releaseInfo = await getReleaseInfo(r => pattern.test(r.name))
  if (!releaseInfo) {
    throw new Error(`No release found for Mac ${archName}`)
  }
  await down(releaseInfo.browser_download_url, false)
  const target = resolve(__dirname, '../', releaseInfo.name)
  showFinalMessage()
  exec(`open ${target}`)
}

// macOS 10.x specific version
async function runMac10 () {
  const releaseInfo = await getReleaseInfo(r => /mac10-x64\.dmg$/.test(r.name))
  if (!releaseInfo) {
    throw new Error('No release found for macOS 10.x')
  }
  await down(releaseInfo.browser_download_url, false)
  const target = resolve(__dirname, '../', releaseInfo.name)
  showFinalMessage()
  exec(`open ${target}`)
}

async function runWin (archName) {
  const ver = await getVer()
  const target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-win-${archName}`)
  const targetNew = resolve(__dirname, '../electerm')
  rm('-rf', [
    target,
    targetNew
  ])
  const pattern = new RegExp(`electerm-\\d+\\.\\d+\\.\\d+-win-${archName}\\.tar\\.gz$`)
  const releaseInfo = await getReleaseInfo(r => pattern.test(r.name))
  if (!releaseInfo) {
    throw new Error(`No release found for Windows ${archName}`)
  }
  await down(releaseInfo.browser_download_url)
  await mv(target, targetNew)
  showFinalMessage()
  require('child_process').execFile(`${targetNew}\\electerm.exe`)
}

// Windows 7 specific version
async function runWin7 () {
  const ver = await getVer()
  const target = resolve(__dirname, `../electerm-${ver.replace('v', '')}-win7`)
  const targetNew = resolve(__dirname, '../electerm')
  rm('-rf', [
    target,
    targetNew
  ])
  const releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win7\.tar\.gz$/.test(r.name))
  if (!releaseInfo) {
    throw new Error('No release found for Windows 7')
  }
  await down(releaseInfo.browser_download_url)
  await mv(target, targetNew)
  showFinalMessage()
  require('child_process').execFile(`${targetNew}\\electerm.exe`)
}

async function main () {
  console.log(`Detected platform: ${plat}, architecture: ${arch}`)

  // Check for legacy systems
  const win7 = isWindows7OrEarlier(plat, os.release())
  const mac10 = isMacOS10(plat, os.release())
  const linuxLegacy = isLinuxLegacy(plat)

  if (win7) console.log('Detected: Windows 7 or earlier')
  if (mac10) console.log('Detected: macOS 10.x')
  if (linuxLegacy) console.log('Detected: Linux with glibc < 2.34 (legacy)')

  console.log('Fetching release information...\n')

  try {
    if (plat === 'win32') {
      // Windows: x64, arm64, win7
      if (win7) {
        await runWin7()
      } else if (arch === 'arm64') {
        await runWin('arm64')
      } else {
        // Default to x64 for all other Windows architectures
        await runWin('x64')
      }
    } else if (plat === 'darwin') {
      // macOS: x64, arm64, mac10
      if (mac10) {
        await runMac10()
      } else if (arch === 'arm64') {
        await runMac('arm64')
      } else {
        // Default to x64 for Intel Macs
        await runMac('x64')
      }
    } else if (plat === 'linux') {
      // Linux: x64, arm64, armv7l (with legacy variants)
      const suffix = linuxLegacy ? '-legacy' : ''
      if (arch === 'arm64') {
        await runLinux(`linux-arm64${suffix}`, `linux-arm64${suffix}.tar.gz`)
      } else if (arch === 'arm') {
        await runLinux(`linux-armv7l${suffix}`, `linux-armv7l${suffix}.tar.gz`)
      } else {
        // Default to x64 for all other Linux architectures
        await runLinux(`linux-x64${suffix}`, `linux-x64${suffix}.tar.gz`)
      }
    } else {
      throw new Error(`Platform "${plat}" is not supported.`)
    }
  } catch (err) {
    console.error('\n========================================')
    console.error('Installation failed!')
    console.error('========================================')
    console.error(`Error: ${err.message}`)
    console.error(`\nPlatform: ${plat}, Architecture: ${arch}`)
    console.error('\nPlease visit https://electerm.html5beta.com for manual download options.')
    console.error('========================================\n')
    process.exit(1)
  }
}

// Export functions for testing
module.exports = {
  isWindows7OrEarlier,
  isMacOS10,
  isLinuxLegacy,
  getDownloadPattern
}

// Run main only if this file is executed directly
if (require.main === module) {
  main()
}
