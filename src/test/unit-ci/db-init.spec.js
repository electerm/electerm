/**
 * A startup read must never see a db that has not been seeded yet.
 *
 * On a brand new profile the default data (sample bookmarks, default quick
 * commands) is written by src/app/upgrade/init-db.js, and the store reads the
 * tables exactly once, at startup. A read that wins that race leaves the store
 * empty for the whole session -- nothing re-reads it -- which is how a fresh
 * install came up with no bookmarks at all.
 *
 * src/app/lib/init-data.js now awaits an injected ensureReady before the first
 * table, and src/app/upgrade exports the memoized ensureDbInit that both that
 * read and the renderer's checkDbUpgrade share, so the two cannot seed twice.
 */

// runtime-constants resolves package.json from the *built* app layout, so the
// dev branch (which points at the repo root) is the one that works here
process.env.NODE_ENV = 'development'

const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// app-props (pulled in by upgrade/index.js) reads electron's app paths at
// require time; a plain node process has no electron
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => os.tmpdir(),
        isPackaged: false
      }
    }
  }
  if (request === 'electron-log') {
    const noop = () => {}
    return {
      transports: { console: {}, file: {}, ipc: {} },
      info: noop,
      error: noop,
      warn: noop,
      log: noop,
      debug: noop
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const root = path.resolve(__dirname, '../../..')
const abs = rel => path.resolve(root, rel)
const packVersion = require(abs('package.json')).version

/**
 * Load src/app/upgrade/index.js against a stubbed db layer.
 * @param {object} [opts]
 * @param {string} [opts.version] stored db version, '0.0.0' is a fresh db
 * @param {boolean} [opts.seedThrows] make the seed step fail
 * @returns {object} state, plus the module under test
 */
function setup ({ version = '0.0.0', seedThrows = false } = {}) {
  const state = {
    version,
    seeded: 0,
    stamped: 0,
    rows: { bookmarks: [] }
  }
  const dbAction = async (name, op, query) => {
    if (name === 'data' && op === 'findOne' && query && query._id === 'version') {
      return { value: state.version }
    }
    if (op === 'find') {
      return state.rows[name] || []
    }
    return null
  }
  const cache = rel => require.resolve(abs(rel))
  const stub = (rel, exports) => {
    const p = cache(rel)
    require.cache[p] = { id: p, filename: p, loaded: true, exports }
  }
  stub('src/app/common/log', {
    error () {},
    info () {},
    warn () {},
    debug () {}
  })
  stub('src/app/lib/db', { dbAction, tables: [] })
  stub('src/app/upgrade/init-db', async () => {
    if (seedThrows) {
      throw new Error('SQLITE_CORRUPT')
    }
    state.seeded++
    state.rows.bookmarks = [{ _id: 'default-local-zsh', title: 'zsh' }]
  })
  stub('src/app/upgrade/version-upgrade', {
    updateDBVersion: async (v) => {
      state.stamped++
      state.version = v
    }
  })
  delete require.cache[cache('src/app/upgrade/index.js')]
  state.upgrade = require(cache('src/app/upgrade/index.js'))
  state.dbAction = dbAction
  return state
}

describe('startup read on a fresh profile', () => {
  const read = s => require(abs('src/app/lib/init-data'))
    .createLoadInitData(s.dbAction, ['bookmarks', 'data'], () => s.upgrade.ensureDbInit())

  test('the read only sees the defaults because it waited for the seed', async () => {
    const s = setup()
    const res = await read(s)(['bookmarks'])
    assert.deepEqual(
      res.tables.bookmarks.rows.map(r => r._id),
      ['default-local-zsh'],
      'a fresh profile must hand the store its sample bookmarks'
    )
  })

  test('without the guard the same read comes back empty: the bug', async () => {
    // what ci run 43678433890 hit: the batched read won the race against
    // init-db, the store kept `bookmarks: []` for the whole session
    const s = setup()
    const res = await require(abs('src/app/lib/init-data'))
      .createLoadInitData(s.dbAction, ['bookmarks', 'data'])(['bookmarks'])
    assert.deepEqual(res.tables.bookmarks.rows, [])
  })
})

describe('ensureDbInit', () => {
  test('seeds a db that has never been initialised', async () => {
    const s = setup()
    assert.equal(await s.upgrade.ensureDbInit(), true)
    assert.equal(s.seeded, 1, 'the default data is inserted')
    assert.equal(s.stamped, 1, 'the version is stamped, so the next start skips it')
    assert.equal(s.version, packVersion)
  })

  test('seeds once when the startup read and checkDbUpgrade race', async () => {
    const s = setup()
    const [seeded, shouldUpgrade] = await Promise.all([
      s.upgrade.ensureDbInit(),
      s.upgrade.checkDbUpgrade()
    ])
    assert.equal(seeded, true)
    assert.equal(shouldUpgrade, false, 'a just-seeded db is not an upgrade')
    assert.equal(s.seeded, 1, 'the defaults must never be inserted twice')
  })

  test('is a no-op on a db that is already initialised', async () => {
    const s = setup({ version: packVersion })
    assert.equal(await s.upgrade.ensureDbInit(), false)
    assert.equal(s.seeded, 0)
    assert.equal(s.stamped, 0)
    assert.equal(await s.upgrade.checkDbUpgrade(), false)
  })

  test('an older db with no upgrade scripts only gets its version stamped', async () => {
    const s = setup({ version: '1.0.0' })
    assert.equal(await s.upgrade.checkDbUpgrade(), false)
    assert.equal(s.seeded, 0, 'an existing db is never re-seeded')
    assert.equal(s.stamped, 1)
  })

  test('a seeding failure reports "not seeded" instead of rejecting', async () => {
    const s = setup({ seedThrows: true })
    // the startup read awaits this: a rejected promise there would turn a
    // broken db into a failed read, and the read already reports its own
    assert.equal(await s.upgrade.ensureDbInit(), false)
  })
})
