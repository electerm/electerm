/**
 * post install script
 */
const { cp, exec, rm } = require('shelljs')
const { existsSync } = require('fs')
const { resolve } = require('path')
const prePushPath = resolve(__dirname, '../../.git/hooks/pre-push')
const prePushPathFrom = resolve(__dirname, 'pre-push')
const os = require('os')

const platform = os.platform()
const isWin = platform === 'win32'
// const rest = ''
if (isWin && process.env.CI) {
  exec('npm cache clear -f')
  exec('npm uninstall node-gyp -g')
  exec('npm install node-gyp -g')
}

// Remove optional native module that may fail to rebuild
try {
  // Check multiple potential locations for cpu-features
  const cpuFeaturesPaths = [
    resolve(__dirname, '../../node_modules/cpu-features'),
    resolve(__dirname, '../../work/app/node_modules/cpu-features')
  ]

  cpuFeaturesPaths.forEach(cpuFeaturesPath => {
    if (existsSync(cpuFeaturesPath)) {
      rm('-rf', cpuFeaturesPath)
      console.log('Removed optional module:', cpuFeaturesPath)
    }
  })
} catch (e) {
  console.warn('Failed to remove cpu-features:', e?.message || e)
}

// Quoted, because this resolves to an absolute path and is handed to a shell.
// An unquoted path containing a space is split into separate arguments, so the
// rebuild never runs on a checkout under e.g. C:\Users\me\Project Code\electerm.
exec(`"${resolve(__dirname, '../../node_modules/.bin/electron-rebuild')}"`)

if (!existsSync(prePushPath)) {
  cp(prePushPathFrom, prePushPath)
}
