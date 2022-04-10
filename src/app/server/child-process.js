/**
 * run server in child process
 *
 */

const { fork } = require('child_process')
const { resolve } = require('path')
const log = require('../common/log')

module.exports = (config, env, sysLocale) => {
  // start server
  const child = fork(resolve(__dirname, './server.js'), {
    env: Object.assign(
      {
        LANG: `${sysLocale.replace(/-/, '_')}.UTF-8`,
        electermPort: config.port,
        electermHost: config.host,
        tokenElecterm: config.tokenElecterm
      },
      env
    ),
    cwd: process.cwd()
  }, (error, stdout, stderr) => {
    if (error || stderr) {
      throw error || stderr
    }
    log.info(stdout)
  })
  return child
}
