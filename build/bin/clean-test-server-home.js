#!/usr/bin/env node
/**
 * Wipe the CI test server home folder, keeping only `.cache`.
 *
 * Every e2e CI job (test1..test4) logs into the shared test host with its own
 * account (TEST_USER_n / TEST_PASS_n) and leaves stuff behind in that account's
 * home — sftp test folders/files, uploads, sync files, ... Repeated runs pile
 * up until the accounts are a mess, and some file-manager tests assume a
 * predictable home folder.
 *
 * So: connect with `@electerm/ssh2` (already a dependency, same library the
 * app uses client-side — no sshpass/expect needed on the runner), then delete
 * every entry in `$HOME` except `.cache`.
 *
 * env: TEST_HOST, TEST_USER, TEST_PASS required, TEST_PORT optional (mirrors
 * src/test/e2e/common/env.js so it hits the exact server the tests used).
 * Set CLEAN_TEST_SERVER_DRY_RUN=1 to only list what would be removed.
 */

const os = require('os').platform()
const { Client } = require('@electerm/ssh2')

const env = process.env
const TEST_HOST = env[`TEST_HOST_${os}`] || env.TEST_HOST
const TEST_USER = env[`TEST_USER_${os}`] || env.TEST_USER
const TEST_PASS = env[`TEST_PASS_${os}`] || env.TEST_PASS
const TEST_PORT = env[`TEST_PORT_${os}`] || env.TEST_PORT || '22'

if (!TEST_HOST || !TEST_USER || !TEST_PASS) {
  console.error(`
[clean-test-server] need TEST_HOST TEST_USER TEST_PASS env set
  `)
  process.exit(1)
}

const dryRun = env.CLEAN_TEST_SERVER_DRY_RUN === '1'
// -print so the CI log shows exactly what is going away
const action = dryRun ? '-print' : '-print -exec rm -rf {} +'

// `cd "$HOME"` first, after refusing an empty $HOME and any landing on `/`.
// Every path find emits starts with "./", so nothing can be mistaken for an
// rm option.
const COMMAND = `
set -e
[ -n "$HOME" ] || exit 1
cd "$HOME" || exit 1
[ "$(pwd)" != / ] || exit 1
echo "[clean-test-server] host $(hostname) / user $(whoami) / home $(pwd)"
echo "[clean-test-server] before:"
ls -A | sed 's/^/  /'
echo "[clean-test-server] ${dryRun ? 'would remove' : 'removing'} (keeping .cache):"
find . -mindepth 1 -maxdepth 1 ! -name .cache ${action}
echo "[clean-test-server] after:"
ls -A | sed 's/^/  /'
`

function run () {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec(COMMAND, (err, stream) => {
        if (err) {
          conn.end()
          reject(err)
          return
        }
        let code = 0
        stream.on('data', data => process.stdout.write(data))
        stream.stderr.on('data', data => process.stderr.write(data))
        stream.on('exit', c => {
          if (typeof c === 'number') {
            code = c
          }
        })
        stream.on('close', () => {
          conn.end()
          resolve(code)
        })
      })
    })
    conn.on('error', reject)
    conn.connect({
      host: TEST_HOST,
      port: Number(TEST_PORT) || 22,
      username: TEST_USER,
      password: TEST_PASS,
      // dedicated test-only host, no known_hosts entry to verify against
      hostVerifier: () => true,
      readyTimeout: 20000
    })
  })
}

run().then(code => {
  if (code !== 0) {
    console.error(`[clean-test-server] remote command exited with ${code}`)
  }
  process.exit(code)
}).catch(err => {
  console.error(`[clean-test-server] failed: ${err.message}`)
  process.exit(1)
})
