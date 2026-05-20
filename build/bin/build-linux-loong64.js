/**
 * Build electerm for loong64 (LoongArch64) Linux
 *
 * This script orchestrates the loong64 build process:
 * 1. Build x64 version with electron v39.2.7 to get the asar
 * 2. Download electron loong64 v39.2.7
 * 3. Cross-compile native modules for loong64
 * 4. Merge x64 asar with loong64 electron and native modules
 * 5. Upload tar.gz to GitHub release draft
 * 6. Build deb package (patched asar) and upload to GitHub release draft
 */

const { resolve } = require('path')
const { echo } = require('shelljs')
const { run } = require('./build-common')

const SCRIPT_PATH = resolve(__dirname, 'build-linux-loong64.sh')

async function main () {
  echo('Starting electerm loong64 build...')

  try {
    await run(`bash ${SCRIPT_PATH}`)
    echo('Loong64 build completed successfully!')
  } catch (err) {
    console.error('Loong64 build failed:', err.message)
    process.exit(1)
  }
}

main()
