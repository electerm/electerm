/**
 * run server in child process
 *
 */

const { fork } = require('child_process')
const { resolve } = require('path')
const { writeFileSync, unlinkSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const log = require('../common/log')
const getSystemCAs = require('../lib/system-ca')

// NODE_USE_SYSTEM_CA was introduced in Node 24.6 and backported to 22.19.
function needsExport ({ platform, nodeVersion }) {
  const [major, minor] = nodeVersion.split('.').map(Number)
  const supportsNativeCA = major > 24 || (major === 24 && minor >= 6) ||
    (major === 22 && minor >= 19)
  return platform !== 'win32' || !supportsNativeCA
}

function serverEnv (config, env, sysLocale, extraCaFile) {
  // Clean Electron-specific env vars from child process environment
  const cleanEnv = Object.assign({}, env)
  delete cleanEnv.ELECTRON_RUN_AS_NODE

  return {
    ...cleanEnv,
    LANG: env.LANG ?? `${sysLocale.replace(/-/, '_')}.UTF-8`,
    electermPort: config.port,
    electermHost: config.host,
    requireAuth: config.requireAuth || '',
    tokenElecterm: config.tokenElecterm,
    ELECTERM_DEBUG: config.debug ? '1' : '',
    ELECTERM_SHELL_USE_SYSTEM_CA: env.NODE_USE_SYSTEM_CA,
    NODE_USE_SYSTEM_CA: '1',
    NODE_EXTRA_CA_CERTS: env.NODE_EXTRA_CA_CERTS || extraCaFile
  }
}

module.exports = (config, env, sysLocale) => {
  let extraCaFile
  const systemCAs = !env.NODE_EXTRA_CA_CERTS &&
    needsExport({ platform: process.platform, nodeVersion: process.versions.node }) &&
    getSystemCAs()
  if (systemCAs) {
    extraCaFile = join(tmpdir(), `electerm-system-ca-${Date.now()}.pem`)
    writeFileSync(extraCaFile, systemCAs)
  }

  const child = fork(resolve(__dirname, './server.js'), {
    env: serverEnv(config, env, sysLocale, extraCaFile),
    cwd: process.cwd()
  }, (error, stdout, stderr) => {
    if (error || stderr) {
      throw error || stderr
    }
    log.info(stdout)
  })

  if (extraCaFile) {
    child.on('exit', () => {
      try { unlinkSync(extraCaFile) } catch {}
    })
  }

  return child
}

module.exports.needsExport = needsExport
module.exports.serverEnv = serverEnv
