/**
 * common functions for build
 */

const { exec } = require('child_process')
const { resolve } = require('path')
const { writeFileSync, readFileSync } = require('fs')
const replace = require('replace-in-file')

exports.run = function (cmd) {
  return new Promise((resolve, reject) => {
    console.log('Executing command:', cmd)
    const childProcess = exec(cmd, {
      env: {
        ...process.env,
        DEBUG: 'electron-builder:*',
        ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || '',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false' // Disable auto-discovery for clearer errors
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

exports.changeTeamId = function () {
  console.log('Setting APPLE_TEAM_ID:', process.env.APPLE_TEAM_ID ? 'SET' : 'NOT SET')
  exports.replaceArr(['__teamId'], [process.env.APPLE_TEAM_ID])
}

exports.replaceJSON = function (func) {
  const pth = resolve(__dirname, '../../electron-builder.json')
  const js = require(pth)
  func(js)
  writeFileSync(pth, JSON.stringify(js, null, 2))
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
