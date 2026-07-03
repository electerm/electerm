/**
 * common functions for build
 */

const { exec } = require('child_process')
const { resolve } = require('path')
const { writeFileSync, readFileSync } = require('fs')
const replace = require('replace-in-file')
const { rm, mv } = require('shelljs')

exports.run = function (cmd) {
  return new Promise((resolve, reject) => {
    console.log('Executing command:', cmd)
    const childProcess = exec(cmd, {
      env: {
        ...process.env,
        DEBUG: 'electron-builder:*',
        ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || ''
      },
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large debug output
    }, (err, stdout, stderr) => {
      // Always log stdout and stderr regardless of success/failure
      if (stdout) {
        console.log('=== STDOUT ===')
        console.log(stdout)
      }
      if (stderr) {
        console.log('=== STDERR ===')
        console.log(stderr)
      }

      if (err) {
        console.error('=== COMMAND FAILED ===')
        console.error('Command:', cmd)
        console.error('Exit code:', err.code)
        console.error('Signal:', err.signal)
        console.error('Error message:', err.message)

        // Create a more detailed error message
        const detailedError = new Error(`Command failed with exit code ${err.code}: ${cmd}`)
        detailedError.originalError = err
        detailedError.stdout = stdout
        detailedError.stderr = stderr
        detailedError.command = cmd
        return reject(detailedError)
      }

      resolve(stdout)
    })

    // Also pipe output in real-time for long-running commands
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data)
    })

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data)
    })
  })
}

exports.writeSrc = function (src) {
  const p = resolve(__dirname, '../../work/app/lib/install-src.js')
  writeFileSync(p, `module.exports = '${src}'`)
  if (src.includes('AppImage')) {
    exports.patchAppImage()
  }
}

/**
 * Patch work/app to include AppImage desktop integration.
 * Copies the integration module and wires it into create-app.js
 * so the .desktop file + icon are installed on first run.
 * Only called for AppImage builds — zero overhead for other targets.
 */
exports.patchAppImage = function patchAppImage () {
  const fs = require('fs')
  const workLib = resolve(__dirname, '../../work/app/lib')
  const workAssets = resolve(__dirname, '../../work/app/assets/images')

  // Copy integration module to work/app/lib/
  const modSrc = resolve(__dirname, 'appimage-integration.js')
  const modDst = resolve(workLib, 'appimage-integration.js')
  fs.copyFileSync(modSrc, modDst)

  // Copy icon for desktop integration (outside asar, accessible at runtime)
  const iconSrc = resolve(
    __dirname, '../../node_modules/@electerm/electerm-resource/res/imgs/electerm-round-128x128.png'
  )
  const iconDst = resolve(workAssets, 'electerm-round-128x128.png')
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, iconDst)
  }

  // Patch create-app.js to import and call installDesktopFile
  const createAppPath = resolve(workLib, 'create-app.js')
  let code = fs.readFileSync(createAppPath, 'utf8')
  if (!code.includes('installDesktopFile')) {
    code = code.replace(
      "const log = require('../common/log')",
      "const log = require('../common/log')\n" +
      "const { installDesktopFile } = require('./appimage-integration')"
    )
    code = code.replace(
      'app.setName(packInfo.name)',
      'app.setName(packInfo.name)\n  installDesktopFile()'
    )
    fs.writeFileSync(createAppPath, code)
  }
  console.log('[appimage] Patched work/app for desktop integration')
}

exports.builder = resolve(
  __dirname, '../../node_modules/.bin/electron-builder'
)

exports.reBuild = resolve(
  __dirname, '../../node_modules/.bin/electron-rebuild'
)

exports.replaceArr = function (froms, tos) {
  const pth = resolve(__dirname, '../../electron-builder.json')
  console.log('electron-builder', pth)
  let str = readFileSync(pth, 'utf8')
  for (let i = 0; i < froms.length; i++) {
    str = str.replace(froms[i], tos[i])
  }
  writeFileSync(pth, str)
}

exports.replaceJSON = function (func) {
  const pth = resolve(__dirname, '../../electron-builder.json')
  const js = require(pth)
  func(js)
  writeFileSync(pth, JSON.stringify(js, null, 2))
}

exports.setChannel = function (suffix) {
  exports.replaceJSON((data) => {
    if (!data.linux) { data.linux = {} }
    if (!data.linux.publish) { data.linux.publish = {} }
    data.linux.publish.channel = '${env.WORKFLOW_NAME}-' + suffix // eslint-disable-line
  })
}

const options = {
  files: require('path').resolve(__dirname, '../../electron-builder.json'),
  from: ['"asar": true', '${productName}-${version}-${os}-${arch}.${ext}', ', "appx", "nsis"'], // eslint-disable-line
  to: ['"asar": false', '${productName}-${version}-${os}-${arch}-loose.${ext}', ''] // eslint-disable-line
}

exports.replaceRun = function () {
  return new Promise((resolve, reject) => {
    replace(options, (err) => {
      if (err) {
        return reject(err)
      }
      console.log('start build loose file(no asar)')
      resolve()
    })
  })
}

const shouldKeepFile = !!process.env.KEEP_FILE

exports.renameDist = function renameDist () {
  if (!shouldKeepFile) {
    return rm('-rf', 'dist')
  }
  mv('dist', 'dist' + new Date().getTime())
}

exports.uploadToR2 = async function uploadToR2 (src) {
  // Must be running in CI
  if (!process.env.CI) {
    console.log('[r2] Skipping upload: not in CI environment')
    return
  }

  // Check commit message contains "[r2]"
  const { execSync } = require('child_process')
  let commitMsg = ''
  try {
    commitMsg = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim()
  } catch (e) {
    console.log('[r2] Skipping upload: could not read commit message')
    return
  }
  if (!commitMsg.includes('[r2]')) {
    console.log('[r2] Skipping upload: commit message does not contain "[r2]"')
    return
  }

  // Check required env vars
  const accountId = process.env.CF_R2_ACCOUNT_ID
  const bucket = process.env.CF_R2_BUCKET
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    console.error('[r2] Missing required env vars: CF_R2_ACCOUNT_ID, CF_R2_BUCKET, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY')
    return
  }

  // Find the built file in dist/
  const fs = require('fs')
  const path = require('path')
  const distDir = resolve(__dirname, '../../dist')
  let filePath = null
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir)
    const match = files.find(f => f.endsWith(src))
    if (match) {
      filePath = path.join(distDir, match)
    }
  }
  if (!filePath) {
    // Try to find recursively one level deeper
    if (fs.existsSync(distDir)) {
      const entries = fs.readdirSync(distDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = path.join(distDir, entry.name)
          const subFiles = fs.readdirSync(subDir)
          const match = subFiles.find(f => f.endsWith(src))
          if (match) {
            filePath = path.join(subDir, match)
            break
          }
        }
      }
    }
  }
  if (!filePath) {
    console.error(`[r2] Could not find built file matching "${src}" in dist/`)
    return
  }

  console.log(`[r2] Uploading ${filePath} to R2 bucket "${bucket}" as "${path.basename(filePath)}"`)

  // Polyfill crypto.getRandomValues for Node < 19.
  // @smithy/core reads getRandomValues from require('node:crypto') directly
  // (line: const _getRandomValues = node_crypto.getRandomValues), so we must
  // patch the crypto module itself, not just globalThis.crypto.
  const nodeCrypto = require('crypto')
  if (!nodeCrypto.getRandomValues) {
    nodeCrypto.getRandomValues = (buf) => nodeCrypto.randomFillSync(buf)
  }
  if (!globalThis.crypto) {
    globalThis.crypto = nodeCrypto
  }

  let S3Client, PutObjectCommand
  try {
    const s3Module = require('@aws-sdk/client-s3')
    S3Client = s3Module.S3Client
    PutObjectCommand = s3Module.PutObjectCommand
  } catch (e) {
    console.error('[r2] @aws-sdk/client-s3 is not installed. Run: npm install --save-dev @aws-sdk/client-s3')
    throw e
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })

  const fileStream = fs.createReadStream(filePath)
  const key = path.basename(filePath)
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentLength: fs.statSync(filePath).size
  })

  await client.send(command)
  console.log(`[r2] Successfully uploaded ${key} to R2`)
}

/**
 * Patch the electron-builder NSIS template so that the installer always tries
 * to keep shortcuts (desktop / start-menu / taskbar pins) when upgrading.
 *
 * By default, when `allowToChangeInstallationDirectory` is set, the template
 * sets `isTryToKeepShortcuts = "false"` for manual (non-auto-update) installs,
 * which causes `WinShell::UninstShortcut` / `UninstAppUserModelId` to be called
 * and the taskbar pin to be silently removed. Removing the guard makes the
 * installer always pass `--keep-shortcuts` to the old uninstaller when the
 * previous install wrote `KeepShortcuts = "true"` to the registry.
 */
exports.patchNsisKeepShortcuts = function patchNsisKeepShortcuts () {
  const fs = require('fs')
  const path = require('path')
  const templatePath = path.join(
    require.resolve('app-builder-lib/package.json'),
    '../templates/nsis/include/installUtil.nsh'
  )
  const original = fs.readFileSync(templatePath, 'utf-8')
  const patched = original.replace(
    /(!macro setIsTryToKeepShortcuts\s+StrCpy \$isTryToKeepShortcuts "true"\s*)!ifdef allowToChangeInstallationDirectory[\s\S]*?!endif(\s*!macroend)/,
    '$1$2'
  )
  if (patched === original) {
    console.log('NSIS keep-shortcuts patch: already applied or pattern not found, skipping')
  } else {
    fs.writeFileSync(templatePath, patched, 'utf-8')
    console.log('NSIS keep-shortcuts patch: applied successfully')
  }
}

/**
 * Patch electron-builder's Snap target so classic confinement builds keep the
 * Chromium sandbox and do not force --no-sandbox into the generated launcher.
 *
 * electerm's packaged entrypoint rejects the --no-sandbox CLI flag, and classic
 * snaps do not need the browser-support plug path used by strict confinement.
 */
exports.patchSnapClassicSandbox = function patchSnapClassicSandbox () {
  const fs = require('fs')
  const path = require('path')
  const targetPath = path.join(
    require.resolve('app-builder-lib/package.json'),
    '../out/targets/snap.js'
  )
  const original = fs.readFileSync(targetPath, 'utf-8')
  const patched = original.replace(
    '        if (this.isElectronVersionGreaterOrEqualThan("5.0.0") && !isBrowserSandboxAllowed(snap)) {',
    '        if (this.isElectronVersionGreaterOrEqualThan("5.0.0") && snap.confinement !== "classic" && !isBrowserSandboxAllowed(snap)) {'
  )

  if (patched === original) {
    console.log('Snap classic sandbox patch: already applied or pattern not found, skipping')
  } else {
    fs.writeFileSync(targetPath, patched, 'utf-8')
    console.log('Snap classic sandbox patch: applied successfully')
  }
}
