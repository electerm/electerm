process.env.NODE_ENV = 'development'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { session, test: checkConnection } = require('../../app/server/session-ssh')
const {
  startTestSshServer, stopTestSshServer, TEST_USERNAME, TEST_PASSWORD
} = require('../integration/lib/ssh-test-server')
const { createTrustingWs } = require('../integration/lib/ssh-session-harness')

test('only an X11-enabled shell requests the built-in display', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-x11-'))
  t.mock.method(os, 'homedir', () => home)
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))

  const cookies = []
  const server = await startTestSshServer({
    port: 0,
    onX11 (accept, reject, request) {
      cookies.push(request.cookie.toString())
      accept()
    }
  })
  t.after(() => stopTestSshServer(server))
  const options = {
    host: '127.0.0.1',
    port: server.address().port,
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    useSshAgent: false
  }
  const displayModule = require.resolve('electerm-x11')
  function assertUnloaded () {
    assert.equal(require.cache[displayModule], undefined)
  }

  assertUnloaded()
  for (const flags of [{ x11: false }, { x11: true, enableSsh: false }]) {
    const term = await session({ ...options, ...flags }, createTrustingWs())
    try {
      assert.equal(term.shellOpts.x11, undefined)
      assertUnloaded()
    } finally {
      term.kill()
    }
  }
  assert.ok(await checkConnection({ ...options, x11: true }, createTrustingWs()))
  assertUnloaded()
  assert.deepEqual(cookies, [])
  const term = await session({ ...options, x11: true }, createTrustingWs())
  try {
    assert.match(term.builtinDisplay.cookie, /^[a-f0-9]{32}$/)
    assert.deepEqual(cookies, [term.builtinDisplay.cookie])
  } finally {
    term.kill()
  }
})
