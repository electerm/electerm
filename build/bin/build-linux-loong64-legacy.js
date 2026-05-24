/**
 * Build electerm for loong64 (LoongArch64) Linux - Legacy (old world)
 *
 * This script orchestrates the loong64 legacy build process:
 * 1. Build x64 version with legacy deps to get the asar
 * 2. Download electron loong64 from Loongnix FTP
 * 3. Cross-compile native modules for loong64 (node-pty@0.10.1, serialport@10.5.0)
 * 4. Merge x64 asar with loong64 electron and native modules
 * 5. Upload tar.gz to GitHub release draft
 * 6. Build deb package and upload to GitHub release draft
 */

const { resolve } = require('path')
const { echo } = require('shelljs')
const { run } = require('./build-common')

const SCRIPT_PATH = resolve(__dirname, 'build-linux-loong64-legacy.sh')

async function main () {
  echo('Starting electerm loong64-legacy build...')

  try {
    await run(`bash ${SCRIPT_PATH}`)
    echo('Loong64-legacy build completed successfully!')
  } catch (err) {
    console.error('Loong64-legacy build failed:', err.message)
    process.exit(1)
  }
}

main()
