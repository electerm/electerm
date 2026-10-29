const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { resolve } = require('node:path')

// The opt-in WebGL E2E (src/test/e2e/004.webgl-lifecycle.spec.js) must launch
// with the same upstream plumbing every other E2E gets from ./app-options.js --
// a user-data dir, NODE_TEST, and the explicit sandbox opt-out -- while keeping
// the GPU enabled. A helper that re-lists the arguments by hand drifts silently:
// it was written when app-options.js had no user-data-dir. Pin the inheritance
// contract instead.
//
// Scope: this file covers what the helper inherits from app-options.js. It says
// nothing about per-launch isolation -- app-options creates its user-data dir
// once per module load, so two launches in one worker share it. The E2E itself
// goes through ./common/webgl-test-isolation.js for one data root and profile
// per launch; that is pinned by webgl-test-isolation.spec.js.

const root = resolve(__dirname, '../../..')
const HELPER = './src/test/e2e/common/app-options-webgl'

// Each child process requires the real helper and prints what it exported. The
// helper is required in a child (not here) so the launch-time env snapshot and
// the freshly created user-data dir are read exactly as Electron would see
// them, and so a second process gets a second temp dir.
function readOptions (envOverrides = {}) {
  const script = `
    const base = require('./src/test/e2e/common/app-options')
    const webgl = require(${JSON.stringify(HELPER)})
    process.stdout.write(JSON.stringify({
      base: { env: base.env, args: base.args },
      webgl: { env: webgl.env, args: webgl.args }
    }))
  `
  const env = { ...process.env, ...envOverrides }
  // Clear every value app-options.js reads from the environment (plus the
  // sandbox variable it copies through ...process.env), so the defaults
  // asserted below are the helper's, not this machine's.
  for (const key of [
    'ELECTERM_E2E_NO_SANDBOX',
    'ELECTERM_E2E_USER_DATA',
    'ELECTRON_DISABLE_SANDBOX'
  ]) {
    if (!(key in envOverrides)) {
      delete env[key]
    }
  }
  const out = execFileSync(process.execPath, ['-e', script], {
    cwd: root,
    env,
    encoding: 'utf8'
  })
  return JSON.parse(out)
}

function userDataDirArg (args) {
  return args.find(arg => arg.startsWith('--user-data-dir='))
}

describe('app-options-webgl', () => {
  it('enables the GPU by removing only the --disable-gpu flag', () => {
    const { base, webgl } = readOptions()

    assert.equal(webgl.args.includes('--disable-gpu'), false)
    assert.deepEqual(
      webgl.args,
      base.args.filter(arg => arg !== '--disable-gpu'),
      'the WebGL helper must be app-options.js minus --disable-gpu'
    )
    // The app entrypoint and the shared plumbing still come from app-options.
    assert.equal(base.args[0], resolve(root, 'work/app'))
    assert.equal(webgl.args[0], resolve(root, 'work/app'))
    assert.equal(webgl.args.includes('--disable-dev-shm-usage'), true)
  })

  it('keeps the user-data dir inherited from app-options', () => {
    const first = readOptions()
    const second = readOptions()

    const dir = userDataDirArg(first.webgl.args)
    assert.ok(dir, 'the WebGL helper must inherit --user-data-dir')
    assert.equal(dir, userDataDirArg(first.base.args))
    assert.match(dir, /--user-data-dir=.+electerm-e2e-/)

    // Not a hardcoded path: a separate module load (here: a separate process)
    // mints a separate dir. Per-launch isolation is a different contract, owned
    // by webgl-test-isolation.spec.js.
    assert.notEqual(
      userDataDirArg(second.webgl.args),
      dir,
      'a separate module load must mint a fresh user-data dir'
    )
  })

  it('keeps NODE_TEST and forwards the explicit sandbox opt-out', () => {
    // Linux always disables the sandbox in app-options.js (unprivileged user
    // namespaces are restricted on CI); elsewhere the sandbox stays unless the
    // environment opts out explicitly.
    const isLinux = process.platform === 'linux'
    const plain = readOptions()
    assert.equal(plain.webgl.env.NODE_TEST, 'yes')
    assert.equal(plain.base.env.NODE_TEST, 'yes')
    assert.equal(plain.webgl.args.includes('--no-sandbox'), isLinux)
    assert.equal(plain.base.args.includes('--no-sandbox'), isLinux)
    assert.equal(plain.webgl.env.ELECTRON_DISABLE_SANDBOX, isLinux ? '1' : undefined)

    const noSandbox = readOptions({ ELECTERM_E2E_NO_SANDBOX: '1' })
    assert.equal(noSandbox.base.args.includes('--no-sandbox'), true)
    assert.equal(noSandbox.webgl.args.includes('--no-sandbox'), true)
    assert.deepEqual(
      noSandbox.webgl.args,
      noSandbox.base.args.filter(arg => arg !== '--disable-gpu')
    )
    assert.equal(noSandbox.webgl.env.NODE_TEST, 'yes')
  })

  it('reuses an explicit ELECTERM_E2E_USER_DATA dir when asked to', () => {
    const shared = resolve(root, '.tmp-app-options-webgl-noop')
    const { base, webgl } = readOptions({ ELECTERM_E2E_USER_DATA: shared })
    assert.equal(userDataDirArg(base.args), `--user-data-dir=${shared}`)
    assert.equal(userDataDirArg(webgl.args), `--user-data-dir=${shared}`)
  })
})
