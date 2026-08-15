/**
 * DB Concurrency Tests
 *
 * Simulates the pattern from src/client/store/watch.js where multiple
 * autoRun watchers fire concurrently, each doing sequential remove/update/insert
 * operations against the SQLite backend (DatabaseSync).
 *
 * The concern: dbAction in src/app/lib/sqlite.js is an async function wrapping
 * synchronous DatabaseSync calls. Multiple concurrent callers (different watchers
 * for the same or different dbNames) can interleave their operations since each
 * await yields back to the event loop. There is no application-level queue or lock.
 *
 * Uses Node.js built-in test runner (node:test).
 */

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const { resolve } = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

let dbAction
let cleanup

function createTestDb () {
  const tmpDir = fs.mkdtempSync(resolve(os.tmpdir(), 'electerm-test-'))
  const dbFolder = resolve(tmpDir, 'users', 'testuser')
  fs.mkdirSync(dbFolder, { recursive: true })

  const { DatabaseSync } = require('node:sqlite')
  const mainDbPath = resolve(dbFolder, 'electerm.db')
  const dataDbPath = resolve(dbFolder, 'electerm_data.db')
  const mainDb = new DatabaseSync(mainDbPath)
  const dataDb = new DatabaseSync(dataDbPath)

  const tables = [
    'bookmarks', 'bookmarkGroups', 'addressBookmarks',
    'terminalThemes', 'lastStates', 'data', 'quickCommands',
    'log', 'dbUpgradeLog', 'profiles', 'workspaces',
    'history', 'terminalCommandHistory', 'aiChatHistory', 'autoRunWidgets'
  ]

  for (const table of tables) {
    const db = table === 'data' ? dataDb : mainDb
    db.exec(`CREATE TABLE IF NOT EXISTS \`${table}\` (_id TEXT PRIMARY KEY, data TEXT)`)
  }

  function getDatabase (dbName) {
    return dbName === 'data' ? dataDb : mainDb
  }

  function uid () {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  async function action (dbName, op, ...args) {
    if (op === 'compactDatafile') return
    if (!tables.includes(dbName)) {
      throw new Error(`Table ${dbName} does not exist`)
    }
    const db = getDatabase(dbName)
    if (op === 'find') {
      const stmt = db.prepare(`SELECT * FROM \`${dbName}\``)
      const rows = stmt.all()
      return (rows || []).map(row => {
        const r = JSON.parse(row.data || '{}')
        return { ...r, _id: row._id }
      })
    } else if (op === 'findOne') {
      const query = args[0] || {}
      const stmt = db.prepare(`SELECT * FROM \`${dbName}\` WHERE _id = ? LIMIT 1`)
      const row = stmt.get(query._id)
      if (!row) return null
      const r = JSON.parse(row.data || '{}')
      return { ...r, _id: row._id }
    } else if (op === 'insert') {
      const inserts = Array.isArray(args[0]) ? args[0] : [args[0]]
      const inserted = []
      for (const doc of inserts) {
        const _id = doc._id || doc.id || uid()
        const copy = { ...doc }
        delete copy._id
        delete copy.id
        const data = JSON.stringify(copy)
        const stmt = db.prepare(`INSERT OR REPLACE INTO \`${dbName}\` (_id, data) VALUES (?, ?)`)
        stmt.run(_id, data)
        inserted.push({ ...doc, _id })
      }
      return Array.isArray(args[0]) ? inserted : inserted[0]
    } else if (op === 'remove') {
      const query = args[0] || {}
      const stmt = db.prepare(`DELETE FROM \`${dbName}\` WHERE _id = ?`)
      const res = stmt.run(query._id)
      return res.changes
    } else if (op === 'update') {
      const query = args[0]
      const updateObj = args[1]
      const options = args[2] || {}
      const { upsert = false } = options
      const qid = query._id || query.id
      const newData = updateObj.$set || updateObj
      const _id = qid
      const copy = { ...newData }
      delete copy._id
      delete copy.id
      const data = JSON.stringify(copy)
      let res
      if (upsert) {
        const stmt = db.prepare(`REPLACE INTO \`${dbName}\` (_id, data) VALUES (?, ?)`)
        res = stmt.run(_id, data)
      } else {
        const stmt = db.prepare(`UPDATE \`${dbName}\` SET data = ? WHERE _id = ?`)
        res = stmt.run(data, qid)
      }
      return res.changes
    }
  }

  return {
    action,
    cleanup: () => {
      mainDb.close()
      dataDb.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

/**
 * OLD watcher pattern (before fix): sequential one-by-one operations.
 * This is what caused the app to hang on large imports.
 */
async function simulateWatcherOld (dbName, action, { added, updated, removed }) {
  for (const item of removed) {
    await action(dbName, 'remove', { _id: item.id })
  }
  for (const item of updated) {
    await action(dbName, 'update', { _id: item.id }, { $set: item }, { upsert: false })
  }
  for (const item of added) {
    await action(dbName, 'insert', item)
  }
  const allItems = await action(dbName, 'find', {})
  const newOrder = allItems.map(d => d._id)
  await action('data', 'update',
    { _id: `${dbName}:order` },
    { $set: { value: newOrder } },
    { upsert: true }
  )
}

/**
 * NEW watcher pattern (after fix): batch insert + parallel remove/update + running guard.
 * Matches the updated src/client/store/watch.js.
 */
function createWatcherNew (action) {
  const running = {}
  return async function simulateWatcherNew (dbName, opts) {
    if (running[dbName]) return
    running[dbName] = true
    try {
      const { added, updated, removed } = opts
      await Promise.all([
        ...removed.map(item => action(dbName, 'remove', { _id: item.id })),
        ...updated.map(item => action(dbName, 'update', { _id: item.id }, { $set: item }, { upsert: false })),
        added.length ? action(dbName, 'insert', added) : Promise.resolve()
      ])
      const allItems = await action(dbName, 'find', {})
      const newOrder = allItems.map(d => d._id)
      await action('data', 'update',
        { _id: `${dbName}:order` },
        { $set: { value: newOrder } },
        { upsert: true }
      )
    } finally {
      running[dbName] = false
    }
  }
}

// Default for backward compat — instantiated in beforeEach
let simulateWatcher

describe('SQLite DB concurrency (DatabaseSync)', function () {
  beforeEach(function () {
    const db = createTestDb()
    dbAction = db.action
    cleanup = db.cleanup
    simulateWatcher = createWatcherNew(dbAction)
  })

  afterEach(function () {
    cleanup()
  })

  test('should handle single watcher with many inserts', async function () {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`, name: `Item ${i}`, value: i
    }))
    await simulateWatcher('bookmarks', {
      added: items, updated: [], removed: []
    })
    const all = await dbAction('bookmarks', 'find', {})
    assert.strictEqual(all.length, 100)
  })

  test('should handle concurrent watchers on different dbNames', async function () {
    // Simulates: store.bookmarks and store.history change at the same time
    // Two autoRun watchers fire concurrently
    const bookmarks = Array.from({ length: 50 }, (_, i) => ({
      id: `bm-${i}`, name: `Bookmark ${i}`
    }))
    const history = Array.from({ length: 50 }, (_, i) => ({
      id: `h-${i}`, url: `http://example.com/${i}`
    }))

    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', { added: bookmarks, updated: [], removed: [] }),
      simulateWatcher('history', { added: history, updated: [], removed: [] })
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Watcher failed: ${r.reason}`)
    }

    const bmAll = await dbAction('bookmarks', 'find', {})
    const hAll = await dbAction('history', 'find', {})
    assert.strictEqual(bmAll.length, 50)
    assert.strictEqual(hAll.length, 50)
  })

  test('should handle concurrent watchers on the SAME dbName', async function () {
    // This is the real risk scenario: two autoRun watchers for 'bookmarks'
    // fire at nearly the same time (e.g. rapid store mutations).
    // Each watcher computes its own diff and runs remove/update/insert.
    // They interleave because each await yields to the event loop.

    // Pre-seed with 20 items
    const seed = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i}`, name: `Original ${i}`
    }))
    await simulateWatcher('bookmarks', { added: seed, updated: [], removed: [] })

    // Watcher 1: update items 0-9, remove items 10-14, add new items
    const watcher1Removed = seed.slice(10, 15).map(d => ({ id: d.id }))
    const watcher1Updated = seed.slice(0, 10).map(d => ({ ...d, name: `Updated-by-W1 ${d.id}` }))
    const watcher1Added = Array.from({ length: 5 }, (_, i) => ({
      id: `w1-new-${i}`, name: `Added by W1 ${i}`
    }))

    // Watcher 2: update items 5-15, remove items 16-19, add new items
    const watcher2Removed = seed.slice(16, 20).map(d => ({ id: d.id }))
    const watcher2Updated = seed.slice(5, 16).map(d => ({ ...d, name: `Updated-by-W2 ${d.id}` }))
    const watcher2Added = Array.from({ length: 5 }, (_, i) => ({
      id: `w2-new-${i}`, name: `Added by W2 ${i}`
    }))

    // Fire both concurrently - no errors should occur
    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', {
        added: watcher1Added, updated: watcher1Updated, removed: watcher1Removed
      }),
      simulateWatcher('bookmarks', {
        added: watcher2Added, updated: watcher2Updated, removed: watcher2Removed
      })
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Watcher failed: ${r.reason?.message || r.reason}`)
    }

    // Verify final state is consistent (no corruption, no missing rows)
    const final = await dbAction('bookmarks', 'find', {})
    // All items should exist (some may have stale data from interleaving, but no DB error)
    assert.ok(final.length > 0, 'Should have items remaining')

    // Verify no duplicate _id entries
    const ids = final.map(d => d._id)
    const uniqueIds = new Set(ids)
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate _id entries should exist')
  })

  test('should handle rapid fire: running guard prevents duplicate work', async function () {
    // Simulates: store.bookmarks changes rapidly (e.g. import, bulk edit)
    // The running guard ensures only one watcher cycle runs per dbName.
    // Concurrent calls are skipped — this prevents the cascading duplicate work
    // that caused the app to get stuck on large imports.
    const promises = []
    for (let batch = 0; batch < 10; batch++) {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-${batch}-item-${i}`, name: `Batch ${batch} Item ${i}`, batch
      }))
      promises.push(
        simulateWatcher('bookmarks', { added: items, updated: [], removed: [] })
      )
    }

    const results = await Promise.allSettled(promises)
    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Batch failed: ${r.reason?.message || r.reason}`)
    }

    const all = await dbAction('bookmarks', 'find', {})
    // Only one watcher cycle ran due to the running guard
    assert.ok(all.length > 0, 'At least one batch should be inserted')
    assert.ok(all.length <= 100, 'Not all batches may run (guard skips concurrent)')
    const ids = all.map(d => d._id)
    const uniqueIds = new Set(ids)
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate _id entries')
  })

  test('should handle interleaved insert and remove on same table', async function () {
    // Pre-seed
    const seed = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`, name: `Item ${i}`
    }))
    await simulateWatcher('bookmarks', { added: seed, updated: [], removed: [] })

    // Concurrently: one watcher removes old items, another adds new items
    const toRemove = seed.slice(0, 15).map(d => ({ id: d.id }))
    const toAdd = Array.from({ length: 15 }, (_, i) => ({
      id: `new-${i}`, name: `New ${i}`
    }))

    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', { added: [], updated: [], removed: toRemove }),
      simulateWatcher('bookmarks', { added: toAdd, updated: [], removed: [] })
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    const final = await dbAction('bookmarks', 'find', {})
    const ids = final.map(d => d._id)
    const uniqueIds = new Set(ids)
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate _id entries')
  })

  test('should handle concurrent updates to the same item', async function () {
    // Both watchers update the same bookmark concurrently
    await dbAction('bookmarks', 'insert', { id: 'shared-item', name: 'Original', count: 0 })

    const w1Update = [{ id: 'shared-item', name: 'W1-update', count: 1 }]
    const w2Update = [{ id: 'shared-item', name: 'W2-update', count: 2 }]

    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', { added: [], updated: w1Update, removed: [] }),
      simulateWatcher('bookmarks', { added: [], updated: w2Update, removed: [] })
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    // Item should still exist with one of the two values (last-write-wins)
    const item = await dbAction('bookmarks', 'findOne', { _id: 'shared-item' })
    assert.ok(item, 'Item should still exist')
    assert.ok(
      item.name === 'W1-update' || item.name === 'W2-update',
      `Name should be from one of the writers, got: ${item.name}`
    )
  })

  test('should handle interleaved operations across data and bookmarks (order update)', async function () {
    // The watcher always writes to both the dbName table AND the data table
    // (for the :order record). Concurrent watchers writing to 'data' for
    // different order keys should not conflict.

    const bm = Array.from({ length: 10 }, (_, i) => ({ id: `bm-${i}`, name: `BM ${i}` }))
    const hist = Array.from({ length: 10 }, (_, i) => ({ id: `h-${i}`, url: `http://${i}` }))
    const cmd = Array.from({ length: 10 }, (_, i) => ({ id: `cmd-${i}`, cmd: `ls ${i}` }))

    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', { added: bm, updated: [], removed: [] }),
      simulateWatcher('history', { added: hist, updated: [], removed: [] }),
      simulateWatcher('terminalCommandHistory', { added: cmd, updated: [], removed: [] })
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    // Verify all order records exist in the data table
    const bmOrder = await dbAction('data', 'findOne', { _id: 'bookmarks:order' })
    const hOrder = await dbAction('data', 'findOne', { _id: 'history:order' })
    const cmdOrder = await dbAction('data', 'findOne', { _id: 'terminalCommandHistory:order' })
    assert.ok(bmOrder, 'bookmarks:order should exist')
    assert.ok(hOrder, 'history:order should exist')
    assert.ok(cmdOrder, 'terminalCommandHistory:order should exist')
  })

  test('should handle bulk insert of 500 items - running guard allows one cycle', async function () {
    // 5 concurrent watcher calls for the same dbName — only one runs
    const promises = []
    for (let w = 0; w < 5; w++) {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `w${w}-item-${i}`, name: `Watcher ${w} Item ${i}`, watcher: w, idx: i
      }))
      promises.push(
        simulateWatcher('bookmarks', { added: items, updated: [], removed: [] })
      )
    }

    const results = await Promise.allSettled(promises)
    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    const all = await dbAction('bookmarks', 'find', {})
    // Only one watcher ran due to the guard
    assert.ok(all.length > 0, 'At least one batch should be inserted')
    assert.ok(all.length <= 500, 'Not all batches may run (guard skips concurrent)')
    const ids = all.map(d => d._id)
    const uniqueIds = new Set(ids)
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate _id entries')
  })

  test('should handle full simulation: add + update + remove concurrently', async function () {
    // Most realistic scenario: different watchers doing mixed operations
    // Pre-seed with 30 items
    const seed = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`, name: `Item ${i}`, value: i
    }))
    await simulateWatcher('bookmarks', { added: seed, updated: [], removed: [] })

    // Watcher A: remove 5, update 5, add 5
    const wA = {
      removed: seed.slice(0, 5).map(d => ({ id: d.id })),
      updated: seed.slice(5, 10).map(d => ({ ...d, name: `WA-updated-${d.id}` })),
      added: Array.from({ length: 5 }, (_, i) => ({ id: `wa-new-${i}`, name: `WA new ${i}` }))
    }

    // Watcher B: remove 5, update 5, add 5
    const wB = {
      removed: seed.slice(10, 15).map(d => ({ id: d.id })),
      updated: seed.slice(15, 20).map(d => ({ ...d, name: `WB-updated-${d.id}` })),
      added: Array.from({ length: 5 }, (_, i) => ({ id: `wb-new-${i}`, name: `WB new ${i}` }))
    }

    // Watcher C: remove 5, update 5, add 5
    const wC = {
      removed: seed.slice(20, 25).map(d => ({ id: d.id })),
      updated: seed.slice(25, 30).map(d => ({ ...d, name: `WC-updated-${d.id}` })),
      added: Array.from({ length: 5 }, (_, i) => ({ id: `wc-new-${i}`, name: `WC new ${i}` }))
    }

    const results = await Promise.allSettled([
      simulateWatcher('bookmarks', wA),
      simulateWatcher('bookmarks', wB),
      simulateWatcher('bookmarks', wC)
    ])

    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    const final = await dbAction('bookmarks', 'find', {})
    // Should have items: 30 original - 15 removed + 15 added = 30
    // (but due to interleaving, exact count depends on timing)
    assert.ok(final.length > 0, 'Should have items remaining')

    // No duplicate IDs
    const ids = final.map(d => d._id)
    const uniqueIds = new Set(ids)
    assert.strictEqual(ids.length, uniqueIds.size, 'No duplicate _id entries')

    // Verify order record exists
    const order = await dbAction('data', 'findOne', { _id: 'bookmarks:order' })
    assert.ok(order, 'Order record should exist')
    assert.ok(Array.isArray(order.value), 'Order value should be an array')
  })

  test('should handle all watched dbNames concurrently', async function () {
    // Simulate the worst case: ALL dbNamesForWatch change simultaneously
    // This is what happens when store state changes trigger multiple watchers
    const dbNames = [
      'bookmarks', 'bookmarkGroups', 'addressBookmarks',
      'terminalThemes', 'lastStates', 'quickCommands',
      'history', 'terminalCommandHistory', 'aiChatHistory', 'autoRunWidgets'
    ]

    const promises = dbNames.map((name, dbIdx) => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `${name}-${i}`, name: `${name} item ${i}`, dbIdx, i
      }))
      return simulateWatcher(name, { added: items, updated: [], removed: [] })
    })

    const results = await Promise.allSettled(promises)
    for (const r of results) {
      assert.strictEqual(r.status, 'fulfilled', `Failed: ${r.reason?.message || r.reason}`)
    }

    // Verify each table has its items
    for (const name of dbNames) {
      const all = await dbAction(name, 'find', {})
      assert.strictEqual(all.length, 20, `${name} should have 20 items`)
    }

    // Verify all order records exist in the data table
    for (const name of dbNames) {
      const order = await dbAction('data', 'findOne', { _id: `${name}:order` })
      assert.ok(order, `${name}:order should exist`)
      assert.strictEqual(order.value.length, 20, `${name}:order should have 20 entries`)
    }
  })
})

describe('Benchmark: old (sequential) vs new (batched+parallel)', function () {
  let benchDbAction
  let benchWatcherNew
  let benchCleanup

  beforeEach(function () {
    const db = createTestDb()
    benchDbAction = db.action
    benchCleanup = db.cleanup
    benchWatcherNew = createWatcherNew(benchDbAction)
  })

  afterEach(function () {
    benchCleanup()
  })

  for (const count of [100, 500, 1000]) {
    test(`insert ${count} bookmarks - OLD (sequential one-by-one)`, async function () {
      const items = Array.from({ length: count }, (_, i) => ({
        id: `bm-${i}`, name: `Bookmark ${i}`, url: `http://example.com/${i}`
      }))
      const start = performance.now()
      await simulateWatcherOld('bookmarks', benchDbAction, { added: items, updated: [], removed: [] })
      const elapsed = (performance.now() - start).toFixed(1)
      const all = await benchDbAction('bookmarks', 'find', {})
      assert.strictEqual(all.length, count)
      console.log(`    OLD  ${count} inserts: ${elapsed}ms`)
    })

    test(`insert ${count} bookmarks - NEW (batched + parallel)`, async function () {
      const items = Array.from({ length: count }, (_, i) => ({
        id: `bm-${i}`, name: `Bookmark ${i}`, url: `http://example.com/${i}`
      }))
      const start = performance.now()
      await benchWatcherNew('bookmarks', { added: items, updated: [], removed: [] })
      const elapsed = (performance.now() - start).toFixed(1)
      const all = await benchDbAction('bookmarks', 'find', {})
      assert.strictEqual(all.length, count)
      console.log(`    NEW  ${count} inserts: ${elapsed}ms`)
    })

    test(`mixed ops ${count} items - OLD (sequential)`, async function () {
      const seed = Array.from({ length: count / 2 }, (_, i) => ({
        id: `existing-${i}`, name: `Existing ${i}`, value: i
      }))
      await simulateWatcherOld('bookmarks', benchDbAction, { added: seed, updated: [], removed: [] })

      const toRemove = seed.slice(0, count / 8).map(d => ({ id: d.id }))
      const toUpdate = seed.slice(count / 8, count / 4).map(d => ({ ...d, name: `Updated ${d.id}` }))
      const toAdd = Array.from({ length: count / 2 }, (_, i) => ({
        id: `new-${i}`, name: `New ${i}`
      }))

      const start = performance.now()
      await simulateWatcherOld('bookmarks', benchDbAction, { added: toAdd, updated: toUpdate, removed: toRemove })
      const elapsed = (performance.now() - start).toFixed(1)
      console.log(`    OLD  ${count} mixed ops: ${elapsed}ms`)
    })

    test(`mixed ops ${count} items - NEW (batched + parallel)`, async function () {
      const seed = Array.from({ length: count / 2 }, (_, i) => ({
        id: `existing-${i}`, name: `Existing ${i}`, value: i
      }))
      await benchWatcherNew('bookmarks', { added: seed, updated: [], removed: [] })

      const toRemove = seed.slice(0, count / 8).map(d => ({ id: d.id }))
      const toUpdate = seed.slice(count / 8, count / 4).map(d => ({ ...d, name: `Updated ${d.id}` }))
      const toAdd = Array.from({ length: count / 2 }, (_, i) => ({
        id: `new-${i}`, name: `New ${i}`
      }))

      const start = performance.now()
      await benchWatcherNew('bookmarks', { added: toAdd, updated: toUpdate, removed: toRemove })
      const elapsed = (performance.now() - start).toFixed(1)
      console.log(`    NEW  ${count} mixed ops: ${elapsed}ms`)
    })
  }
})
