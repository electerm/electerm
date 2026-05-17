/**
 * Build for Linux loong64 (LoongArch 64-bit).
 *
 * Strategy: electron-builder has no native loong64 support, so we:
 *   1. Build a standard x64 deb to obtain the app.asar + package skeleton.
 *   2. Run aosc/aosc-os:latest (linux/loong64) via Docker + QEMU to compile
 *      native modules natively and repackage as a loong64 .deb and .tar.gz.
 *
 * Electron binary: darkyzhou/electron-loong64 v39.2.7
 *   https://github.com/darkyzhou/electron-loong64/releases/tag/v39.2.7
 * Note: electerm normally targets Electron 41.x; pinned to 39.2.7 to match
 * the community loong64 binary (Electron 39.x ships Node.js 22).
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

  // Step 2: Run native loong64 container to compile modules + repackage
  echo('Step 2: Building loong64 package in Docker (loong64 via QEMU)...')
  const electronUrl = process.env.LOONG64_ELECTRON_URL || ''
  await run(
    `docker run --rm --platform linux/loong64 \
      -v "${process.cwd()}:/workspace" \
      -w /workspace \
      -e "LOONG64_ELECTRON_URL=${electronUrl}" \
      aosc/aosc-os:latest \
      bash build/bin/build-loong64-docker.sh`
  )

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
