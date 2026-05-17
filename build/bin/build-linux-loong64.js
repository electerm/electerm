/**
 * Build for Linux loong64 (LoongArch 64-bit).
 *
 * Strategy: electron-builder has no native loong64 support, so we:
 *   1. Build a standard x64 deb to obtain the app.asar + package structure.
 *   2. Cross-compile native modules (node-pty, sshcrypto, serialport) for
 *      loong64 using the loongarch64-linux-gnu toolchain.
 *   3. Swap in the cross-compiled .node files + a community loong64 Electron
 *      binary (set LOONG64_ELECTRON_URL in repo variables/secrets).
 *   4. Repackage as a loong64 .deb and .tar.gz and upload to R2.
 *
 * Electron binary: darkyzhou/electron-loong64 v39.2.7 (latest community loong64 port as of 2026-01)
 *   https://github.com/darkyzhou/electron-loong64/releases/tag/v39.2.7
 * Note: electerm normally targets Electron 41.x; the loong64 binary is pinned to 39.2.7
 * (the closest available community build). The package.json electron version is
 * downgraded to match inside main() before calling electron-builder.
 */
const { echo, rm } = require('shelljs')
const {
  run,
  writeSrc,
  uploadToR2,
  builder: pb,
  replaceJSON,
  renameDist
} = require('./build-common')

async function main () {
  echo('=== Building for Linux loong64 ===')

  // Step 1: Build x64 deb to get the asar + DEBIAN control skeleton
  echo('Step 1: Building x64 deb for package skeleton...')
  rm('-rf', 'dist')
  replaceJSON((data) => {
    data.linux.target = ['deb']
  })
  await run(`${pb} --linux deb --x64`)

  // Step 2: Cross-compile native modules + repackage for loong64
  echo('Step 2: Repackaging for loong64...')
  await run('bash build/bin/build-loong64-package.sh')

  // Step 3: Upload artifacts
  echo('Step 3: Uploading artifacts...')
  let src = 'linux-loong64.tar.gz'
  writeSrc(src)
  await uploadToR2(src)

  src = 'linux-loong64.deb'
  writeSrc(src)
  await uploadToR2(src)

  renameDist()
  echo('=== loong64 build complete ===')
}

main()
