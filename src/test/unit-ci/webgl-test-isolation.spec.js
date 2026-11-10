const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, rmSync, existsSync } = require('node:fs')
const { DatabaseSync } = require('node:sqlite')
const { tmpdir } = require('node:os')
const { basename, join, resolve } = require('node:path')

// The opt-in WebGL E2E launches the real app twice inside one Playwright
// worker. Both launches must get their own electerm data root (DATA_PATH) and
// their own Chromium profile, or a crashed/closing app leaks configuration,
// history and chunk caches into the developer's real ~/.config-ish dir and into
// the next test. These tests exercise the real factory in a single Node
// process -- exactly the shape of "two launches in one worker" -- and pin the
// ownership rules of the cleanup helper.

const iso = require('../e2e/common/webgl-test-isolation')
const base = require('../e2e/common/app-options-webgl')
const { userNoEncryptConfigId } = require('../../app/common/constants')
const defaultUserName = require('../../app/common/default-user-name')

const created = []
const launchOptions = () => {
  const options = iso.createWebglLaunchOptions()
  created.push(options)
  return options
}

const profileArg = args => args.find(arg => arg.startsWith('--user-data-dir='))

after(() => {
  for (const options of created) {
    iso.cleanupWebglLaunchOptions(options)
  }
})

describe('createWebglLaunchOptions', () => {
  it('gives every launch in one process a fresh data root and profile', () => {
    const first = launchOptions()
    const second = launchOptions()

    assert.notEqual(first.env.DATA_PATH, second.env.DATA_PATH)
    assert.match(basename(resolve(first.env.DATA_PATH)), /^data$/)
    assert.match(basename(resolve(second.env.DATA_PATH)), /^data$/)
    assert.match(
      basename(resolve(first.env.DATA_PATH, '..')),
      /^electerm-webgl-e2e-/
    )
    assert.notEqual(
      resolve(first.env.DATA_PATH, '..'),
      resolve(second.env.DATA_PATH, '..')
    )

    const firstProfile = profileArg(first.args)
    const secondProfile = profileArg(second.args)
    assert.ok(firstProfile, 'the launch must carry --user-data-dir')
    assert.ok(secondProfile, 'the launch must carry --user-data-dir')
    assert.notEqual(firstProfile, secondProfile)
    // Exactly one profile per launch: a leftover inherited flag would make
    // Electron's "--user-data-dir" resolution ambiguous.
    assert.equal(
      first.args.filter(arg => arg.startsWith('--user-data-dir=')).length,
      1
    )
    assert.equal(
      firstProfile,
      `--user-data-dir=${resolve(first.env.DATA_PATH, '..', 'profile')}`
    )
    assert.equal(
      secondProfile,
      `--user-data-dir=${resolve(second.env.DATA_PATH, '..', 'profile')}`
    )
  })

  it('seeds the isolated data root so a developer-run app cannot swallow the launch', () => {
    const options = launchOptions()
    const dbPath = join(
      options.env.DATA_PATH,
      'users',
      defaultUserName,
      'electerm_data.db'
    )
    assert.equal(existsSync(dbPath), true, 'the isolated data root must be seeded')

    const db = new DatabaseSync(dbPath)
    try {
      const row = db
        .prepare('SELECT data FROM data WHERE _id = ?')
        .get(userNoEncryptConfigId)
      assert.ok(row, 'the no-encrypt config row must exist')
      assert.equal(JSON.parse(row.data).allowMultiInstance, true)
    } finally {
      db.close()
    }
  })

  it('does not mutate the shared base options', () => {
    const before = JSON.stringify({ env: base.env, args: base.args })
    const first = launchOptions()
    const second = launchOptions()

    assert.equal(JSON.stringify({ env: base.env, args: base.args }), before)
    assert.notEqual(first.args, base.args)
    assert.notEqual(first.env, base.env)
    assert.notEqual(second.env.DATA_PATH, base.env.DATA_PATH)
  })

  it('keeps every upstream launch argument and environment value', () => {
    const options = launchOptions()
    const { args, env } = options

    assert.equal(env.NODE_TEST, base.env.NODE_TEST)
    assert.equal(env.ELECTRON_DISABLE_SANDBOX, base.env.ELECTRON_DISABLE_SANDBOX)
    assert.equal(args.includes('--disable-gpu'), false)
    assert.equal(args[0], base.args[0])
    assert.equal(args.includes('--disable-dev-shm-usage'), true)

    // Every base argument survives byte for byte except the profile flag,
    // which the factory replaces with the per-launch one.
    const upstream = base.args.filter(arg => !arg.startsWith('--user-data-dir='))
    const mine = args.filter(arg => !arg.startsWith('--user-data-dir='))
    assert.deepEqual(mine, upstream)

    // ... and the sandbox flags are inherited, not re-derived.
    for (const flag of ['--no-sandbox', '--disable-setuid-sandbox']) {
      assert.equal(args.includes(flag), base.args.includes(flag))
    }
  })
})

describe('cleanupWebglLaunchOptions', () => {
  it('removes a root it created and refuses everything else', () => {
    const options = launchOptions()
    const root = resolve(options.env.DATA_PATH, '..')
    assert.equal(existsSync(root), true)

    const foreign = mkdtempSync(join(tmpdir(), 'electerm-webgl-not-ours-'))
    try {
      assert.equal(
        iso.cleanupWebglLaunchOptions({ env: { DATA_PATH: join(foreign, 'data') } }),
        false,
        'a directory this module did not create must never be removed'
      )
      assert.equal(existsSync(foreign), true)
    } finally {
      rmSync(foreign, { recursive: true, force: true })
    }

    assert.equal(iso.cleanupWebglLaunchOptions(options), true)
    assert.equal(existsSync(root), false)
    // Idempotent: a second call has nothing left to own.
    assert.equal(iso.cleanupWebglLaunchOptions(options), false)
  })
})

// The parent process (a dev machine already running electerm, or a CI shell
// that inherited its environment) may have exported electermPort,
// electermHost and tokenElecterm. src/app/server/child-process.js builds the
// backend child env with Object.assign(defaults, cleanEnv), where cleanEnv
// overrides its own defaults, so the launched app would connect to the
// developer instance's port (EADDRINUSE) or present the wrong token.
//
// wsPort / type go through the same override mechanism one level deeper:
// src/app/server/session-process.js:41-52 builds the session-server child env
// with Object.assign({ wsPort: port, type }, cleanEnv), where cleanEnv comes
// from process.env and sits last; src/app/server/session-server.js:37-42 reads
// process.env.wsPort/type and calls app.listen directly. A stale session port
// inherited from the parent overrides the freshly allocated one, binding the
// old port (out of sync with what the frontend expects) or failing outright.
// The factory therefore has to delete those five keys from each launch's env
// copy while leaving base.env and every other variable untouched.
describe('inherited session environment', () => {
  const KEYS = ['electermPort', 'electermHost', 'tokenElecterm', 'wsPort', 'type']
  // Unrelated to isolation; proves the cleanup is not a wholesale env replace.
  const SENTINEL_KEY = 'ELECTERM_E2E_ISOLATION_SENTINEL'
  const SENTINEL_VALUE = 'sentinel-kept'

  // The real path has to be loaded while "the parent env already carries these
  // five", otherwise there is no proof they were in the base.env snapshot. A
  // child process simulates it and prints key names and booleans only, never a
  // token or any value.
  function readFactoryWithInheritedEnv (inherited) {
    const script = `
      const iso = require('./src/test/e2e/common/webgl-test-isolation')
      const base = require('./src/test/e2e/common/app-options-webgl')
      const keys = ${JSON.stringify(KEYS)}
      const sentinel = ${JSON.stringify(SENTINEL_KEY)}
      const present = o => keys.filter(k => Object.prototype.hasOwnProperty.call(o, k))
      const parentHas = keys.filter(k => process.env[k] !== undefined)
      const first = iso.createWebglLaunchOptions()
      const second = iso.createWebglLaunchOptions()
      const result = {
        parentHas,
        baseHas: present(base.env),
        baseMatchesParent: keys.filter(k => base.env[k] === process.env[k]),
        launchHas: present(first.env),
        secondLaunchHas: present(second.env),
        baseSentinel: base.env[sentinel] === process.env[sentinel],
        launchSentinel: first.env[sentinel] === process.env[sentinel]
      }
      iso.cleanupWebglLaunchOptions(first)
      iso.cleanupWebglLaunchOptions(second)
      process.stdout.write(JSON.stringify(result))
    `
    const env = { ...process.env, ...inherited }
    const out = execFileSync(process.execPath, ['-e', script], {
      cwd: resolve(__dirname, '../../..'),
      env,
      encoding: 'utf8'
    })
    return JSON.parse(out)
  }

  it('strips the inherited instance and session env from the launch env only', () => {
    const inherited = {
      electermPort: '39876',
      electermHost: '127.0.0.1',
      tokenElecterm: 'inherited-placeholder-token',
      wsPort: '39878',
      type: 'local',
      [SENTINEL_KEY]: SENTINEL_VALUE
    }
    const result = readFactoryWithInheritedEnv(inherited)

    // Precondition: the simulated parent env really carries all five, and the
    // base snapshot inherited their values.
    assert.deepEqual(result.parentHas, KEYS)
    assert.deepEqual(result.baseHas, KEYS)
    assert.deepEqual(result.baseMatchesParent, KEYS)
    assert.equal(result.baseSentinel, true, 'base.env must keep unrelated variables')

    // The fix: each launch env no longer carries them, everything else is kept.
    assert.deepEqual(result.launchHas, [])
    assert.deepEqual(result.secondLaunchHas, [])
    assert.equal(result.launchSentinel, true, 'unrelated variables must survive the cleanup')
  })
})
