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
const { homepage } = require('../package.json')

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
  console.log('https://electerm.html5beta.com')
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
  const releaseInfo = await getReleaseInfo(r => r.name.includes(filePattern))
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
  if (plat === 'linux') {
    const chromeSandboxPath = join(extractDir, 'chrome-sandbox')
    if (fs.existsSync(chromeSandboxPath)) {
      console.log('  Fixing chrome-sandbox permissions...')
      fs.chmodSync(chromeSandboxPath, 0o4755)
    }
  }

  // Clean up temp files
  rm('-rf', tmpDir)

  showFinalMessage()
}

async function runWin (archName) {
  console.log('  [DEBUG] runWin started')
  console.log(`  [DEBUG] packageRoot: ${packageRoot}`)
  console.log(`  [DEBUG] extractDir: ${extractDir}`)

  const rawVer = await getVer()
  const ver = sanitizeVersion(rawVer)

  console.log(`  [DEBUG] Raw version from server: ${rawVer}`)
  console.log(`  Sanitized version: ${ver}`)
  console.log(`  Target: win-${archName}`)

  const target = join(packageRoot, `electerm-${ver}-win-${archName}`)
  console.log(`  [DEBUG] Target folder: ${target}`)

  console.log('  Cleaning old installations...')
  rm('-rf', [target, extractDir])
  console.log('  [DEBUG] Old installations cleaned')

  const pattern = new RegExp(`electerm-\\d+\\.\\d+\\.\\d+-win-${archName}\\.tar\\.gz$`)
  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => pattern.test(r.name))
  if (!releaseInfo) {
    throw new Error(`No release found for Windows ${archName}`)
  }
  console.log(`  [DEBUG] Release info found: ${JSON.stringify(releaseInfo, null, 2)}`)

  const tmpDir = join(packageRoot, '.electerm-tmp')
  console.log(`  [DEBUG] Creating temp directory: ${tmpDir}`)
  rm('-rf', tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })

  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  [DEBUG] Proxy URL: ${proxyUrl}`)
  console.log(`  [DEBUG] Download URL: ${releaseInfo.browser_download_url}`)

  console.log('  Downloading...')
  const { filepath } = await download(releaseInfo.browser_download_url, tmpDir, { extract: false, displayName: releaseInfo.name })
  console.log(`  [DEBUG] Downloaded to: ${filepath}`)
  console.log(`  [DEBUG] File exists: ${fs.existsSync(filepath)}`)
  console.log(`  [DEBUG] File size: ${fs.statSync(filepath).size}`)

  console.log('  Extracting...')
  await extractTarGz(filepath, tmpDir)
  console.log('  [DEBUG] Extraction complete')

  console.log('  [DEBUG] Listing temp directory contents:')
  const entries = fs.readdirSync(tmpDir)
  entries.forEach(e => {
    const fullPath = join(tmpDir, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  const extractedFolder = entries.find(e => fs.statSync(join(tmpDir, e)).isDirectory())

  if (!extractedFolder) {
    console.error('  [DEBUG] No directory found in extracted archive')
    console.error('  [DEBUG] All entries:', entries)
    throw new Error('No folder found in extracted archive')
  }

  console.log(`  [DEBUG] Extracted folder: ${extractedFolder}`)
  console.log('  [DEBUG] Contents of extracted folder:')
  const extractedContents = fs.readdirSync(join(tmpDir, extractedFolder))
  extractedContents.forEach(e => {
    const fullPath = join(tmpDir, extractedFolder, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  console.log(`  Installing to: ${extractDir}`)
  fs.renameSync(join(tmpDir, extractedFolder), extractDir)
  console.log('  [DEBUG] Renamed folder to extractDir')

  console.log('  [DEBUG] Verifying extractDir contents:')
  const installContents = fs.readdirSync(extractDir)
  installContents.forEach(e => {
    const fullPath = join(extractDir, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  rm('-rf', tmpDir)
  console.log('  [DEBUG] Temp directory cleaned')

  const exePath = getElectermExePath()
  console.log(`  [DEBUG] Expected exe path: ${exePath}`)
  console.log(`  [DEBUG] Exe exists: ${fs.existsSync(exePath)}`)
  if (!fs.existsSync(exePath)) {
    throw new Error(`electerm.exe not found at ${exePath} after extraction. Archive may have an unexpected structure.`)
  }

  showFinalMessage()
}

async function runWin7 () {
  console.log('  [DEBUG] runWin7 started')
  console.log(`  [DEBUG] packageRoot: ${packageRoot}`)
  console.log(`  [DEBUG] extractDir: ${extractDir}`)

  const rawVer = await getVer()
  const ver = sanitizeVersion(rawVer)

  console.log(`  [DEBUG] Raw version from server: ${rawVer}`)
  console.log(`  Sanitized version: ${ver}`)
  console.log('  Target: win7')

  const target = join(packageRoot, `electerm-${ver}-win7`)
  console.log(`  [DEBUG] Target folder: ${target}`)

  console.log('  Cleaning old installations...')
  rm('-rf', [target, extractDir])
  console.log('  [DEBUG] Old installations cleaned')

  console.log('  Fetching release info...')
  const releaseInfo = await getReleaseInfo(r => /electerm-\d+\.\d+\.\d+-win7\.tar\.gz$/.test(r.name))
  if (!releaseInfo) {
    throw new Error('No release found for Windows 7')
  }
  console.log(`  [DEBUG] Release info found: ${JSON.stringify(releaseInfo, null, 2)}`)

  const tmpDir = join(packageRoot, '.electerm-tmp')
  console.log(`  [DEBUG] Creating temp directory: ${tmpDir}`)
  rm('-rf', tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })

  const proxyUrl = applyProxy(releaseInfo.browser_download_url)
  console.log(`  [DEBUG] Proxy URL: ${proxyUrl}`)
  console.log(`  [DEBUG] Download URL: ${releaseInfo.browser_download_url}`)

  console.log('  Downloading...')
  const { filepath } = await download(releaseInfo.browser_download_url, tmpDir, { extract: false, displayName: releaseInfo.name })
  console.log(`  [DEBUG] Downloaded to: ${filepath}`)
  console.log(`  [DEBUG] File exists: ${fs.existsSync(filepath)}`)
  console.log(`  [DEBUG] File size: ${fs.statSync(filepath).size}`)

  console.log('  Extracting...')
  await extractTarGz(filepath, tmpDir)
  console.log('  [DEBUG] Extraction complete')

  console.log('  [DEBUG] Listing temp directory contents:')
  const entries = fs.readdirSync(tmpDir)
  entries.forEach(e => {
    const fullPath = join(tmpDir, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  const extractedFolder = entries.find(e => fs.statSync(join(tmpDir, e)).isDirectory())

  if (!extractedFolder) {
    console.error('  [DEBUG] No directory found in extracted archive')
    console.error('  [DEBUG] All entries:', entries)
    throw new Error('No folder found in extracted archive')
  }

  console.log(`  [DEBUG] Extracted folder: ${extractedFolder}`)
  console.log('  [DEBUG] Contents of extracted folder:')
  const extractedContents = fs.readdirSync(join(tmpDir, extractedFolder))
  extractedContents.forEach(e => {
    const fullPath = join(tmpDir, extractedFolder, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  console.log(`  Installing to: ${extractDir}`)
  fs.renameSync(join(tmpDir, extractedFolder), extractDir)
  console.log('  [DEBUG] Renamed folder to extractDir')

  console.log('  [DEBUG] Verifying extractDir contents:')
  const installContents = fs.readdirSync(extractDir)
  installContents.forEach(e => {
    const fullPath = join(extractDir, e)
    const stat = fs.statSync(fullPath)
    console.log(`    [DEBUG] ${e} - ${stat.isDirectory() ? 'DIR' : 'FILE'} (${stat.size} bytes)`)
  })

  rm('-rf', tmpDir)
  console.log('  [DEBUG] Temp directory cleaned')

  const exePath = getElectermExePath()
  console.log(`  [DEBUG] Expected exe path: ${exePath}`)
  console.log(`  [DEBUG] Exe exists: ${fs.existsSync(exePath)}`)
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
  console.log(`Platform: ${plat}, Architecture: ${arch}`)

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
    if (plat === 'win32') {
      if (win7) {
        await runWin7()
      } else if (arch === 'arm64') {
        await runWin('arm64')
      } else {
        await runWin('x64')
      }
    } else if (plat === 'darwin') {
      if (mac10) {
        await runMac10()
      } else if (arch === 'arm64') {
        await runMac('arm64')
      } else {
        await runMac('x64')
      }
    } else if (plat === 'linux') {
      const suffix = linuxLegacy ? '-legacy' : ''
      if (arch === 'arm64' || arch === 'aarch64') {
        await runLinux(`linux-arm64${suffix}`, `linux-arm64${suffix}.tar.gz`)
      } else if (arch === 'arm') {
        await runLinux(`linux-armv7l${suffix}`, `linux-armv7l${suffix}.tar.gz`)
      } else {
        await runLinux(`linux-x64${suffix}`, `linux-x64${suffix}.tar.gz`)
      }
    } else {
      throw new Error(`Platform "${plat}" is not supported.`)
    }
  } catch (err) {
    console.error('')
    console.error('========================================')
    console.error('Installation failed!')
    console.error('========================================')
    console.error(`Error: ${err.message}`)
    console.error(`Platform: ${plat}, Architecture: ${arch}`)
    console.error('')
    console.error('Please visit https://electerm.html5beta.com for manual download options.')
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
  sanitizeVersion,
  sanitizeFilename,
  getElectermExePath,
  isElectermExtracted,
  // Expose for test injection
  _packageRoot: packageRoot,
  _extractDir: extractDir
}

if (require.main === module) {
  main()
}
