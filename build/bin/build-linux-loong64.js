/**
 * Build electerm for loong64 (LoongArch64) Linux
 *
 * This script orchestrates the loong64 build process:
 * 1. Build x64 version with electron v39.2.7 to get the asar
 * 2. Download electron loong64 v39.2.7
 * 3. Use QEMU + loong64 docker to rebuild native modules
 * 4. Merge x64 asar with loong64 electron and native modules
 * 5. Test in QEMU loong64 environment
 */

const { exec } = require('child_process')
const { resolve } = require('path')
const { echo } = require('shelljs')

const SCRIPT_DIR = __dirname
const SCRIPT_PATH = resolve(SCRIPT_DIR, 'build-linux-loong64.sh')

async function run (cmd) {
  return new Promise((resolve, reject) => {
    console.log('Executing command:', cmd)
    const childProcess = exec(cmd, {
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    }, (err, stdout, stderr) => {
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
        console.error('Error message:', err.message)

        const detailedError = new Error(`Command failed with exit code ${err.code}: ${cmd}`)
        detailedError.originalError = err
        detailedError.stdout = stdout
        detailedError.stderr = stderr
        detailedError.command = cmd
        return reject(detailedError)
      }

      resolve(stdout)
    })

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data)
    })

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data)
    })
  })
}

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
