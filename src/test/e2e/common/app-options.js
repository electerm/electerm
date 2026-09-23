const { resolve } = require('path')
const cwd = process.cwd()
const isLinux = process.platform === 'linux'

module.exports = {
  env: {
    ...process.env,
    NODE_TEST: 'yes',
    // Linux CI (e.g. GitHub ubuntu runners) restricts unprivileged user
    // namespaces, so Electron's sandbox can not initialize there
    ...(isLinux ? { ELECTRON_DISABLE_SANDBOX: '1' } : {})
  },
  args: [
    resolve(cwd, 'work/app'),
    '--disable-gpu',
    '--disable-dev-shm-usage',
    // required to launch Electron on Linux CI, harmless elsewhere
    ...(isLinux ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])
  ]
}
