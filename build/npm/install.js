/**
 * install electerm from binary
 * After npm i -g electerm, running `electerm` command will:
 * 1. Download the appropriate binary for the platform
 * 2. Extract it to the package directory (electerm/)
 * 3. The bash script (npm/electerm) then launches the extracted binary
 *
 * This script only downloads and extracts. Launching is handled by the bash script.
 */

const os = require('os')
const { resolve, join } = require('path')
const { execSync, rm, mv } = require('shelljs')
const { execFile } = require('child_process')
const fs = require('fs')
const { phin, download, extractTarGz, GITHUB_PROXY, applyProxy } = require('./utils')

const plat = os.platform()
const arch = os.arch()

/**
 * In the published package this file is at <pkg>/npm/install.js so the manifest
 * is one level up. In a repo checkout it is at build/npm/install.js and the
 * manifest is two levels up. Look in both so the installer can be required
 * (and tested) straight from the repo.
 */
function readHomepage () {
  for (const p of ['../package.json', '../../package.json']) {
    try {
      const { homepage } = require(p)
      if (homepage) {
        return homepage
      }
    } catch (e) {
      // not here, try the next location
    }
  }
  return 'https://electerm.org'
}

const homepage = readHomepage()

const releaseInfoUrl = `${homepage}/data/electerm-github-release.json?_=${+new Date()}`
const versionUrl = `${homepage}/version.html?_=${+new Date()}`

// Directory where electerm package is installed
const packageRoot = resolve(__dirname, '..')
// Directory where the extracted binary will live
const extractDir = join(packageRoot, 'electerm')

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function sanitizeVersion (ver) {
  const clean = String(ver).trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(clean)) {
    throw new Error(
      `Refusing to continue: remote version string failed validation: "${ver}"`
    )
  }
  return clean
}

function sanitizeFilename (name) {
  const clean = String(name).trim()
  if (!/^[\w.-]+$/.test(clean)) {
    throw new Error(
      `Refusing to continue: remote filename failed validation: "${name}"`
    )
  }
  return clean
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function getVer () {
  return phin({
    url: versionUrl,
    timeout: 15000
  })
    .then(res => res.body.toString())
}

function getReleaseInfo (filter) {
  return phin({
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
  console.log('')
  console.log('========================================')
  console.log('electerm installation complete!')
  console.log('========================================')
  console.log('')
  console.log('For more information, documentation, and updates, please visit:')
  console.log('https://electerm.org')
  console.log('')
  console.log('Thank you for using electerm!')
  console.log('========================================')
  console.log('')
}

// ---------------------------------------------------------------------------
// Platform detection helpers
// ---------------------------------------------------------------------------

function isWindows7OrEarlier (platform, release) {
  if (platform !== 'win32') return false
  const [major, minor] = release.split('.').map(Number)
  return major < 10 && (major < 6 || (major === 6 && minor <= 1))
}

function isMacOS10 (platform, release) {
  if (platform !== 'darwin') return false
  const majorVersion = parseInt(release.split('.')[0], 10)
  return majorVersion < 20
}

function isLinuxLegacy (platform) {
  if (platform !== 'linux') return false
  try {
    const result = execSync('ldd --version 2>&1 | head -n1', { encoding: 'utf8' })
    const match = result.match(/(\d+\.\d+)\s*$/)
    if (match) {
      return parseFloat(match[1]) < 2.34
    }
    return false
  } catch (e) {
    return false
  }
}

// ---------------------------------------------------------------------------
// Architecture -> release asset resolution
// ---------------------------------------------------------------------------

// Every Linux release asset we can install, keyed by `os.arch()`.
//
// `legacy: true` means a `-legacy` variant (glibc 2.17+) is published as well.
// riscv64 and ppc64le have no legacy variant on purpose: the Electron runtime
// for those architectures is only published built against a newer glibc, so
// there is nothing to fall back to and the legacy flag must be ignored there
// instead of producing a `linux-riscv64-legacy.tar.gz` that does not exist.
//
// `ia32` (32-bit node on a 64-bit host) maps to x64 on purpose: the kernel runs
// the 64-bit build fine, and electron has no 32-bit build any more.
const LINUX_TARGETS = {
  x64: { name: 'linux-x64', legacy: true },
  ia32: { name: 'linux-x64', legacy: true },
  arm64: { name: 'linux-arm64', legacy: true },
  aarch64: { name: 'linux-arm64', legacy: true },
  arm: { name: 'linux-armv7l', legacy: true },
  armv7l: { name: 'linux-armv7l', legacy: true },
  loong64: { name: 'linux-loong64', legacy: true },
  riscv64: { name: 'linux-riscv64', legacy: false },
  ppc64le: { name: 'linux-ppc64le', legacy: false },
  // node reports `ppc64` for both endiannesses, we only publish little endian
  ppc64: { name: 'linux-ppc64le', legacy: false, littleEndianOnly: true }
}

const SUPPORTED_LINUX_ARCHES = Object.keys(LINUX_TARGETS).sort().join(', ')

/**
 * Resolve the release asset to install for the running platform/arch.
 *
 * @param {string} platform - os.platform()
 * @param {string} arch - os.arch()
 * @param {object} options
 * @param {boolean} options.win7 - Windows 7 or earlier detected
 * @param {boolean} options.mac10 - macOS 10.x detected
 * @param {boolean} options.legacy - Linux with glibc < 2.34 detected
 * @param {string} options.endianness - os.endianness(), only used for ppc64
 * @returns {{type: string, filePattern: string, legacyUnavailable?: boolean}|{type: 'unsupported', reason: string}}
 */
function getDownloadTarget (platform, arch, options = {}) {
  const {
    win7,
    mac10,
    legacy,
    endianness = os.endianness()
  } = options

  if (platform === 'win32') {
    if (win7) {
      return { type: 'win7', filePattern: 'win7.tar.gz' }
    }
    if (arch === 'arm64') {
      return { type: 'win-arm64', filePattern: 'win-arm64.tar.gz' }
    }
    if (arch === 'x64' || arch === 'ia32') {
      return { type: 'win-x64', filePattern: 'win-x64.tar.gz' }
    }
    return { type: 'unsupported', reason: `Windows on "${arch}" is not supported` }
  }

  if (platform === 'darwin') {
    if (mac10) {
      return { type: 'mac10-x64', filePattern: 'mac10-x64.dmg' }
    }
    if (arch === 'arm64') {
      return { type: 'mac-arm64', filePattern: 'mac-arm64.dmg' }
    }
    if (arch === 'x64' || arch === 'ia32') {
      return { type: 'mac-x64', filePattern: 'mac-x64.dmg' }
    }
    return { type: 'unsupported', reason: `macOS on "${arch}" is not supported` }
  }

  if (platform === 'linux') {
    const entry = LINUX_TARGETS[arch]
    if (!entry) {
      return {
        type: 'unsupported',
        reason: `Linux architecture "${arch}" is not supported (supported: ${SUPPORTED_LINUX_ARCHES})`
      }
    }
    if (entry.littleEndianOnly && endianness === 'BE') {
      return {
        type: 'unsupported',
        reason: `Linux ${arch} big-endian is not supported, only little-endian (ppc64le) builds are published`
      }
    }
    const useLegacy = !!legacy && entry.legacy
    const type = useLegacy ? `${entry.name}-legacy` : entry.name
    const result = {
      type,
      filePattern: `${type}.tar.gz`
    }
    if (legacy && !entry.legacy) {
      result.legacyUnavailable = true
    }
    return result
  }

  return { type: 'unsupported', reason: `Platform "${platform}" is not supported` }
}

// ---------------------------------------------------------------------------
// Launch the extracted binary
// ---------------------------------------------------------------------------

/**
 * Get the path to the extracted electerm executable
 */
function getElectermExePath () {
  if (plat === 'win32') {
    return join(extractDir, 'electerm.exe')
  }
  // Linux and macOS (if extracted)
  return join(extractDir, 'electerm')
}

/**
 * Check if the electerm binary has been extracted already
 */
function isElectermExtracted () {
  const exePath = getElectermExePath()
  return fs.existsSync(exePath)
}

// ---------------------------------------------------------------------------
// Platform installers
// ---------------------------------------------------------------------------

async function runLinux (folderName, filePattern) {
  const rawVer = await getVer()
  const ver = sanitizeVersion(rawVer)

  console.log(`  Version: ${ver}`)
  console.log(`  Target: ${folderName}`)

  const target = join(packageRoot, `electerm-${ver}-${folderName}`)

  // Clean up old installations
  rm('-rf', [target, extractDir])

  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => r.name.endsWith(filePattern))
  if (!releaseInfo) {
    throw new Error(`No release found for pattern: ${filePattern}`)
  }

  // Download without extracting to packageRoot directly
  // We'll extract to a temp location first
  const tmpDir = join(packageRoot, '.electerm-tmp')
  rm('-rf', tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })

  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  URL: ${proxyUrl}`)

  const { filepath } = await download(releaseInfo.browser_download_url, tmpDir, { extract: false, displayName: releaseInfo.name })

  // Extract to tmpDir (keeps top-level folder name)
  await extractTarGz(filepath, tmpDir)

  // Find the extracted folder (should be the only directory)
  const entries = fs.readdirSync(tmpDir)
  const extractedFolder = entries.find(e => fs.statSync(join(tmpDir, e)).isDirectory())

  if (!extractedFolder) {
    throw new Error('No folder found in extracted archive')
  }

  // Move to extractDir
  console.log(`  Installing to: ${extractDir}`)
  mv(join(tmpDir, extractedFolder), extractDir)

  // Fix chrome-sandbox permissions on Linux (Electron requires specific permissions)
  // Note: setting the setuid bit requires root ownership, which npm install cannot provide.
  // The launcher handles this by passing --no-sandbox when the sandbox is not root-owned.
  if (plat === 'linux') {
    const chromeSandboxPath = join(extractDir, 'chrome-sandbox')
    if (fs.existsSync(chromeSandboxPath)) {
      console.log('  Note: To enable the Electron sandbox, run:')
      console.log(`    sudo chown root:root "${chromeSandboxPath}"`)
      console.log(`    sudo chmod 4755 "${chromeSandboxPath}"`)
      console.log('  Otherwise, electerm will launch with --no-sandbox automatically.')
    }
  }

  // Clean up temp files
  rm('-rf', tmpDir)

  showFinalMessage()
}

async function runWin (archName) {
  const rawVer = await getVer()
  const ver = sanitizeVersion(rawVer)

  console.log(`  Version: ${ver}`)
  console.log(`  Target: win-${archName}`)

  const target = join(packageRoot, `electerm-${ver}-win-${archName}`)

  rm('-rf', [target, extractDir])
  fs.mkdirSync(extractDir, { recursive: true })

  const pattern = new RegExp(`electerm-\\d+\\.\\d+\\.\\d+-win-${archName}\\.tar\\.gz$`)
  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => pattern.test(r.name))
  if (!releaseInfo) {
    throw new Error(`No release found for Windows ${archName}`)
  }

  // Download to a temp file, then extract directly to extractDir with strip:1
  // (avoids a rename which can fail on Windows when AV has file locks)
  const tmpDir = join(packageRoot, '.electerm-tmp')
  rm('-rf', tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })

  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  URL: ${proxyUrl}`)

  const { filepath } = await download(releaseInfo.browser_download_url, tmpDir, { extract: false, displayName: releaseInfo.name })

  console.log(`  Installing to: ${extractDir}`)
  await extractTarGz(filepath, extractDir, 1)

  rm('-rf', tmpDir)

  const exePath = getElectermExePath()
  if (!fs.existsSync(exePath)) {
    throw new Error(`electerm.exe not found at ${exePath} after extraction. Archive may have an unexpected structure.`)
  }

  showFinalMessage()
}

async function runWin7 () {
  const rawVer = await getVer()
  const ver = sanitizeVersion(rawVer)

  console.log(`  Version: ${ver}`)
  console.log('  Target: win7')

  const target = join(packageRoot, `electerm-${ver}-win7`)

  rm('-rf', [target, extractDir])
  fs.mkdirSync(extractDir, { recursive: true })

  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win7\.tar\.gz$/.test(r.name))
  if (!releaseInfo) {
    throw new Error('No release found for Windows 7')
  }

  const tmpDir = join(packageRoot, '.electerm-tmp')
  rm('-rf', tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })

  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  URL: ${proxyUrl}`)

  const { filepath } = await download(releaseInfo.browser_download_url, tmpDir, { extract: false, displayName: releaseInfo.name })

  console.log(`  Installing to: ${extractDir}`)
  await extractTarGz(filepath, extractDir, 1)

  rm('-rf', tmpDir)

  const exePath = getElectermExePath()
  if (!fs.existsSync(exePath)) {
    throw new Error(`electerm.exe not found at ${exePath} after extraction. Archive may have an unexpected structure.`)
  }

  showFinalMessage()
}

/**
 * Mount a DMG, copy the .app to /Applications, then detach
 * @param {string} dmgPath - Path to the DMG file
 * @returns {Promise<string>} - Path to the installed app
 */
function installFromDmg (dmgPath) {
  return new Promise((resolve, reject) => {
    // Step 1: Mount the DMG
    console.log('  Mounting DMG...')
    execFile('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly'], (err, stdout) => {
      if (err) {
        reject(new Error(`Failed to mount DMG: ${err.message}`))
        return
      }

      // Parse mount point
      const mountMatch = stdout.match(/(\/Volumes\/[^\n]+)/)
      if (!mountMatch) {
        reject(new Error('Could not find mount point'))
        return
      }

      const mountPoint = mountMatch[1].trim()
      console.log(`  Mounted at: ${mountPoint}`)

      // Step 2: Find the .app bundle
      try {
        const entries = fs.readdirSync(mountPoint)
        const appFile = entries.find(e => e.endsWith('.app'))

        if (!appFile) {
          // Try to detach before rejecting
          execFileSyncIgnore('hdiutil', ['detach', mountPoint])
          reject(new Error('No .app bundle found in DMG'))
          return
        }

        const appSource = join(mountPoint, appFile)
        const appDest = `/Applications/${appFile}`

        // Check if app already exists
        if (fs.existsSync(appDest)) {
          console.log(`  Existing app found at ${appDest}, replacing...`)
          // Remove existing app
          rm('-rf', appDest)
        }

        // Step 3: Copy the app to /Applications
        console.log(`  Installing ${appFile} to /Applications...`)
        execFile('cp', ['-R', appSource, appDest], (cpErr) => {
          // Step 4: Detach the DMG (always, regardless of copy result)
          console.log('  Detaching DMG...')
          execFile('hdiutil', ['detach', mountPoint], (detachErr) => {
            if (detachErr) {
              console.log('  Warning: Failed to detach DMG:', detachErr.message)
            } else {
              console.log('  DMG detached')
            }

            if (cpErr) {
              reject(new Error(`Failed to copy app: ${cpErr.message}`))
              return
            }

            console.log(`  App installed to: ${appDest}`)
            resolve(appDest)
          })
        })
      } catch (e) {
        // Try to detach before rejecting
        execFileSyncIgnore('hdiutil', ['detach', mountPoint])
        reject(e)
      }
    })
  })
}

/**
 * Execute a file synchronously, ignoring errors
 */
function execFileSyncIgnore (cmd, args) {
  try {
    execSync(cmd, args, { stdio: 'ignore' })
  } catch (e) {
    // Ignore
  }
}

async function runMac (archName) {
  const pattern = new RegExp(`mac-${archName}\\.dmg$`)
  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => pattern.test(r.name))
  if (!releaseInfo) {
    throw new Error(`No release found for Mac ${archName}`)
  }

  const safeName = sanitizeFilename(releaseInfo.name)
  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  URL: ${proxyUrl}`)

  await download(releaseInfo.browser_download_url, packageRoot, { extract: false, displayName: releaseInfo.name })

  const dmgPath = join(packageRoot, safeName)
  showFinalMessage()

  // Install from DMG automatically
  try {
    await installFromDmg(dmgPath)

    // Clean up DMG
    try {
      fs.unlinkSync(dmgPath)
      console.log('  Cleaned up DMG file')
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('')
    console.log('  Installation complete! You can now launch electerm from /Applications')
  } catch (err) {
    console.error('')
    console.error('  Warning: Automatic installation failed:', err.message)
    console.error('  Please manually copy the app from the DMG to /Applications')
    console.error('')
    console.log('  Opening DMG for manual installation...')
    execFile('open', [dmgPath])
  }
}

async function runMac10 () {
  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => /mac10-x64\.dmg$/.test(r.name))
  if (!releaseInfo) {
    throw new Error('No release found for macOS 10.x')
  }

  const safeName = sanitizeFilename(releaseInfo.name)
  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  URL: ${proxyUrl}`)

  await download(releaseInfo.browser_download_url, packageRoot, { extract: false, displayName: releaseInfo.name })

  const dmgPath = join(packageRoot, safeName)
  showFinalMessage()

  // Install from DMG automatically
  try {
    await installFromDmg(dmgPath)

    // Clean up DMG
    try {
      fs.unlinkSync(dmgPath)
      console.log('  Cleaned up DMG file')
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('')
    console.log('  Installation complete! You can now launch electerm from /Applications')
  } catch (err) {
    console.error('')
    console.error('  Warning: Automatic installation failed:', err.message)
    console.error('  Please manually copy the app from the DMG to /Applications')
    console.error('')
    console.log('  Opening DMG for manual installation...')
    execFile('open', [dmgPath])
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main () {
  console.log('')
  console.log('========================================')
  console.log('electerm binary installer')
  console.log('========================================')
  console.log(`Platform: ${plat}, Architecture: ${arch}${os.endianness() === 'BE' ? ' (big-endian)' : ''}`)

  if (GITHUB_PROXY) {
    console.log(`GitHub Proxy: ${GITHUB_PROXY}`)
  }

  console.log('')

  // Check for legacy systems
  const win7 = isWindows7OrEarlier(plat, os.release())
  const mac10 = isMacOS10(plat, os.release())
  const linuxLegacy = isLinuxLegacy(plat)

  if (win7) console.log('  Detected: Windows 7 or earlier')
  if (mac10) console.log('  Detected: macOS 10.x')
  if (linuxLegacy) console.log('  Detected: Linux with glibc < 2.34 (legacy)')

  console.log('  Fetching release information...')

  try {
    const target = getDownloadTarget(plat, arch, {
      win7,
      mac10,
      legacy: linuxLegacy
    })

    if (target.type === 'unsupported') {
      throw new Error(target.reason)
    }

    if (target.legacyUnavailable) {
      console.log(`  Note: no -legacy build is published for ${arch}, installing the standard build`)
    }

    if (plat === 'win32') {
      if (win7) {
        await runWin7()
      } else if (target.type === 'win-arm64') {
        await runWin('arm64')
      } else {
        await runWin('x64')
      }
    } else if (plat === 'darwin') {
      if (mac10) {
        await runMac10()
      } else if (target.type === 'mac-arm64') {
        await runMac('arm64')
      } else {
        await runMac('x64')
      }
    } else {
      await runLinux(target.type, target.filePattern)
    }
  } catch (err) {
    console.error('')
    console.error('========================================')
    console.error('Installation failed!')
    console.error('========================================')
    console.error(`Error: ${err.message}`)
    console.error(`Platform: ${plat}, Architecture: ${arch}`)
    console.error('')
    console.error('Please visit https://electerm.org for manual download options.')
    console.error('========================================')
    console.error('')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

module.exports = {
  isWindows7OrEarlier,
  isMacOS10,
  isLinuxLegacy,
  getDownloadTarget,
  sanitizeVersion,
  sanitizeFilename,
  getElectermExePath,
  isElectermExtracted,
  LINUX_TARGETS,
  // Expose for test injection
  _packageRoot: packageRoot,
  _extractDir: extractDir
}

if (require.main === module) {
  main()
}
