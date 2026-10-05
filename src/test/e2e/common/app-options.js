const { resolve, join } = require('path')
const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')
const cwd = process.cwd()
const isLinux = process.platform === 'linux'

// The renderer is loaded over http://127.0.0.1:<port>/ and the static server
// sends `Cache-Control: max-age=1 year` for everything, including the entry
// files whose names only carry the app version (`index.html?v=<version>`,
// `js/basic-<version>.js`, `js/electerm-<version>.js`). Rebuild the app
// without bumping the version -- which is the normal local loop -- and the URL
// is unchanged, so Chromium serves the bundle from a previous build without
// revalidating, and the spec exercises code that is no longer on disk.
//
// That cache lives in Electron's userData dir, and on macOS userData is *not*
// redirected by $HOME (it is resolved from the real user's home), so a run that
// looks isolated still shares ~/Library/Application Support/electerm with every
// other run and with the developer's own app. CI never sees this because the
// runner starts with an empty home. Ask for a fresh userData dir so local runs
// behave like CI. Set ELECTERM_E2E_USER_DATA to reuse one instead (e.g. when a
// spec needs state to survive between two launches).
const userDataDir = process.env.ELECTERM_E2E_USER_DATA ||
  mkdtempSync(join(tmpdir(), 'electerm-e2e-'))

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
    `--user-data-dir=${userDataDir}`,
    // required to launch Electron on Linux CI, harmless elsewhere
    ...(isLinux ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
    // Electron's sandbox can also fail to initialize on macOS when the tests
    // run from a restricted context ("sandbox initialization failed: Operation
    // not permitted", which takes the GPU process down with exit_code=6). That
    // is a property of the environment, not something CI has, so keep the
    // sandbox by default and let such an environment opt out explicitly.
    ...(process.env.ELECTERM_E2E_NO_SANDBOX ? ['--no-sandbox'] : [])
  ]
}
