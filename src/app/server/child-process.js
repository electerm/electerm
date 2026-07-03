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

// --use-system-ca is supported since Node.js 24.3.0
function supportsSystemCa () {
  const [major, minor] = process.versions.node.split('.').map(Number)
  return major > 24 || (major === 24 && minor >= 3)
}

module.exports = (config, env, sysLocale) => {
  const nodeOpts = [env.NODE_OPTIONS, supportsSystemCa() ? '--use-system-ca' : '']
    .filter(Boolean).join(' ').trim()

  // Load system-trusted CA certificates and pass to child process
  // via NODE_EXTRA_CA_CERTS so Node.js extends its trust store natively.
  let extraCaFile
  const systemCAs = getSystemCAs()
  if (systemCAs) {
    extraCaFile = join(tmpdir(), `electerm-system-ca-${Date.now()}.pem`)
    writeFileSync(extraCaFile, systemCAs)
  }

  // Clean Electron-specific env vars from child process environment
  const cleanEnv = Object.assign({}, env)
  delete cleanEnv.ELECTRON_RUN_AS_NODE

  // start server
  const child = fork(resolve(__dirname, './server.js'), {
    env: Object.assign(
      {
        LANG: `${sysLocale.replace(/-/, '_')}.UTF-8`,
        electermPort: config.port,
        electermHost: config.host,
        requireAuth: config.requireAuth || '',
        tokenElecterm: config.tokenElecterm,
        sshKeysPath: env.sshKeysPath,
        NODE_OPTIONS: nodeOpts || undefined,
        NODE_EXTRA_CA_CERTS: extraCaFile || undefined
      },
      cleanEnv
    ),
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
