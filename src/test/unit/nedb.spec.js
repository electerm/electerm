/**
 * Unit tests for src/app/lib/nedb.js
 * Focus: per-table write-counter compaction (every 10 writes) and
 * core dbAction correctness with the spy-injected Datastore.
 *
 * Run with:
 *   node --test src/test/unit/nedb.spec.js
 */

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Spy Datastore: wraps persistence.compactDatafile to count compactions,
// injected into the require cache before the lib is loaded
// ---------------------------------------------------------------------------
const nedbPath = require.resolve('@electerm/nedb')
const RealNedb = require(nedbPath)
const compactCalls = []

class SpyNedb extends RealNedb {
  constructor (conf) {
    super(conf)
    const orig = this.persistence.compactDatafile.bind(this.persistence)
    this.persistence.compactDatafile = () => {
      compactCalls.push(this.persistence.filename)
      return orig()
    }
  }
}
require.cache[nedbPath].exports = SpyNedb

const { createDb } = require('../../../src/app/lib/nedb')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-nedb-test-'))
}

// ---------------------------------------------------------------------------
// dbAction basics (no enc/dec)
// ---------------------------------------------------------------------------
describe('nedb dbAction basics', () => {
  let db
  let tmpDir

  before(() => {
    tmpDir = makeTmpDir()
    db = createDb(tmpDir, 'testuser')
  })

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('insert and find returns original data', async () => {
    const doc = { _id: 'bm-1', host: 'example.com', port: 22 }
    const inserted = await db.dbAction('bookmarks', 'insert', doc)
    assert.ok(inserted._id)
    assert.equal(inserted.host, 'example.com')

    const results = await db.dbAction('bookmarks', 'find', {})
    assert.ok(results.some(r => r.host === 'example.com'))
  })

  test('findOne returns correct document', async () => {
    const doc = { _id: 'bm-2', host: 'other.com' }
    const inserted = await db.dbAction('bookmarks', 'insert', doc)
    const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
    assert.equal(found.host, 'other.com')
  })

  test('update modifies data', async () => {
    const doc = { _id: 'bm-3', host: 'update-me.com' }
    const inserted = await db.dbAction('bookmarks', 'insert', doc)
    await db.dbAction('bookmarks', 'update', { _id: inserted._id }, { $set: { host: 'updated.com' } })
    const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
    assert.equal(found.host, 'updated.com')
  })

  test('remove deletes document', async () => {
    const doc = { _id: 'bm-4', host: 'remove-me.com' }
    const inserted = await db.dbAction('bookmarks', 'insert', doc)
    await db.dbAction('bookmarks', 'remove', { _id: inserted._id })
    const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
    assert.equal(found, null)
  })

  test('duplicate id insert falls back to update (uniqueViolated)', async () => {
    const first = await db.dbAction('bookmarks', 'insert', { _id: 'dup-1', host: 'v1.com' })
    assert.equal(first._id, 'dup-1')
    const second = await db.dbAction('bookmarks', 'insert', { _id: 'dup-1', host: 'v2.com' })
    assert.equal(second._id, 'dup-1')
    const found = await db.dbAction('bookmarks', 'findOne', { _id: 'dup-1' })
    assert.equal(found.host, 'v2.com', 'second insert should overwrite the first')
    const all = await db.dbAction('bookmarks', 'find', {})
    assert.equal(all.filter(r => r._id === 'dup-1').length, 1, 'no duplicate docs stored')
  })
})

// ---------------------------------------------------------------------------
// per-table write-counter compaction
// ---------------------------------------------------------------------------
describe('nedb write-counter compaction', () => {
  let db
  let tmpDir

  before(() => {
    tmpDir = makeTmpDir()
    db = createDb(tmpDir, 'testuser')
  })

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  const fileFor = table => path.join(
    tmpDir, 'electerm', 'users', 'testuser', `electerm.${table}.nedb`
  )
  const countFor = table => compactCalls.filter(f => f === fileFor(table)).length

  const doWrites = async (table, n, prefix) => {
    for (let i = 0; i < n; i++) {
      await db.dbAction(table, 'insert', { _id: `${prefix}-${i}`, v: i })
    }
  }

  test('reads do not trigger compaction', async () => {
    await doWrites('quickCommands', 9, 'a')
    await db.dbAction('quickCommands', 'find', {})
    await db.dbAction('quickCommands', 'findOne', { _id: 'a-0' })
    await db.dbAction('quickCommands', 'find', {})
    assert.equal(countFor('quickCommands'), 0, '9 writes + reads should not compact')
  })

  test('10th write triggers exactly one compaction', async () => {
    await db.dbAction('quickCommands', 'insert', { _id: 'a-9', v: 9 })
    assert.equal(countFor('quickCommands'), 1)
  })

  test('data survives compaction and writes still work after it', async () => {
    const found = await db.dbAction('quickCommands', 'findOne', { _id: 'a-5' })
    assert.equal(found.v, 5, 'compacted data still readable')
    await db.dbAction('quickCommands', 'update', { _id: 'a-5' }, { $set: { v: 55 } })
    const updated = await db.dbAction('quickCommands', 'findOne', { _id: 'a-5' })
    assert.equal(updated.v, 55, 'write after compaction works')
  })

  test('counter is per table, not global', async () => {
    await doWrites('history', 9, 'h')
    assert.equal(countFor('history'), 0, 'history has only 9 writes, no compaction yet')
    assert.equal(countFor('quickCommands'), 1, 'quickCommands unchanged')
  })

  test('20th write triggers second compaction', async () => {
    // quickCommands write count is 10 + 1 (the update above) = 11 here
    await doWrites('quickCommands', 9, 'b')
    assert.equal(countFor('quickCommands'), 2, '9 writes land on write #20, second compaction')
  })

  test('remove counts as a write op', async () => {
    // quickCommands write count is 20 here
    await db.dbAction('quickCommands', 'remove', { _id: 'a-0' })
    // write 21; 9 more writes reach write #30 -> third compaction only
    // fires if the remove above was counted
    await doWrites('quickCommands', 9, 'c')
    assert.equal(countFor('quickCommands'), 3)
  })

  test('manual compactDatafile op does not feed the counter', async () => {
    await db.dbAction('log', 'compactDatafile')
    assert.equal(countFor('log'), 1, 'manual op itself compacts')
    await doWrites('log', 9, 'l')
    assert.equal(countFor('log'), 1, '9 writes after manual op, no auto compaction yet')
    await doWrites('log', 1, 'l')
    assert.equal(countFor('log'), 2, '10th write triggers auto compaction')
  })

  test('compacted tables still serve all docs', async () => {
    const results = await db.dbAction('history', 'find', {})
    assert.equal(results.length, 9, 'all history docs intact')
    const qc = await db.dbAction('quickCommands', 'find', {})
    assert.equal(qc.filter(d => d._id === 'a-0').length, 0, 'removed doc stays removed')
    assert.equal(qc.filter(d => d._id === 'a-5').length, 1, 'updated doc intact')
  })
})
