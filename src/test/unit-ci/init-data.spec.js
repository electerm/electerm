/**
 * Batched startup DB read: src/app/lib/init-data.js does the reading in the
 * main process, src/client/common/init-data.js turns the rows into store
 * items. Both halves are pure so this can run in plain node.
 */

const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let toItems
let buildInitData
let createLoadInitData

before(async () => {
  const mod = await import('../../client/common/init-data.js')
  toItems = mod.toItems
  buildInitData = mod.buildInitData
  const appMod = require('../../app/lib/init-data.js')
  createLoadInitData = appMod.createLoadInitData
})

// inverse of pass-enc.js's dec(): charCode + i + 1
const enc = str => str.split('').map((s, i) => (
  String.fromCharCode((s.charCodeAt(0) + i + 1) % 65536)
)).join('')

const row = (id, extra = {}) => ({ _id: id, title: 'item-' + id, ...extra })

describe('toItems', () => {
  test('maps _id to id and keeps every other field', () => {
    assert.deepEqual(
      toItems([row('a', { host: '10.0.0.1' })], undefined),
      [{ id: 'a', title: 'item-a', host: '10.0.0.1' }]
    )
  })

  test('decodes a legacy obfuscated password without mutating the raw row', () => {
    const raw = row('a', { password: enc('s3cret'), passwordEncrypted: true })
    const items = toItems([raw], undefined)
    assert.equal(items[0].password, 's3cret')
    assert.equal(items[0].passwordEncrypted, undefined)
    assert.equal(raw.passwordEncrypted, true, 'IPC rows must stay untouched')
  })

  test('leaves a plain password alone', () => {
    assert.equal(
      toItems([row('a', { password: 'plain' })], undefined)[0].password,
      'plain'
    )
  })

  test('sorts by the saved order', () => {
    const items = toItems(
      [row('a'), row('b'), row('c')],
      ['c', 'b', 'a']
    )
    assert.deepEqual(items.map(d => d.id), ['c', 'b', 'a'])
  })

  test('ids missing from the saved order sort first, as find() did', () => {
    const items = toItems(
      [row('a'), row('z'), row('c')],
      ['c', 'a']
    )
    assert.deepEqual(items.map(d => d.id), ['z', 'c', 'a'])
  })

  test('keeps db order when there is no saved order', () => {
    assert.deepEqual(
      toItems([row('a'), row('b')], []).map(d => d.id),
      ['a', 'b']
    )
    assert.deepEqual(
      toItems([row('a'), row('b')], undefined).map(d => d.id),
      ['a', 'b']
    )
  })

  test('an empty / missing table is an empty array', () => {
    assert.deepEqual(toItems(undefined, undefined), [])
    assert.deepEqual(toItems([], undefined), [])
  })
})

describe('buildInitData', () => {
  const payload = {
    tables: {
      bookmarks: { rows: [row('a')], order: ['a'] },
      history: { rows: [] }
    },
    lastDataUpdateTime: 1700000000000
  }

  test('builds one array per requested table plus lastDataUpdateTime', () => {
    assert.deepEqual(buildInitData(payload, ['bookmarks', 'history']), {
      bookmarks: [{ id: 'a', title: 'item-a' }],
      history: [],
      lastDataUpdateTime: 1700000000000
    })
  })

  test('defaults lastDataUpdateTime to 0', () => {
    assert.equal(
      buildInitData({ tables: { bookmarks: { rows: [] } } }, ['bookmarks']).lastDataUpdateTime,
      0
    )
  })

  test('returns null when the payload is missing or incomplete', () => {
    assert.equal(buildInitData(undefined, ['bookmarks']), null)
    assert.equal(buildInitData({}, ['bookmarks']), null)
    assert.equal(buildInitData(payload, ['bookmarks', 'profiles']), null)
    assert.equal(
      buildInitData({ tables: { bookmarks: { rows: 'not-an-array' } } }, ['bookmarks']),
      null
    )
  })

  test('an old main process IPC answer (undefined) triggers the fallback', async () => {
    // `isExportedIpcFunc` blocks an unknown name and the handler resolves
    // with undefined rather than rejecting
    const answer = await Promise.resolve(undefined)
    assert.equal(buildInitData(answer, ['bookmarks']), null)
  })
})

describe('createLoadInitData', () => {
  const tables = ['bookmarks', 'profiles', 'data']
  const makeDb = () => {
    const calls = []
    const dbAction = async (name, op, query) => {
      calls.push({ name, op, id: query && query._id })
      if (op === 'find') {
        return name === 'bookmarks' ? [row('a'), row('b')] : []
      }
      if (query._id === 'lastDataUpdateTime') {
        return { value: 42 }
      }
      return { value: ['b', 'a'] }
    }
    return { calls, dbAction }
  }

  test('reads every table, its :order record and lastDataUpdateTime', async () => {
    const { calls, dbAction } = makeDb()
    const res = await createLoadInitData(dbAction, tables)(['bookmarks', 'profiles'])
    assert.deepEqual(res.tables.bookmarks, {
      rows: [row('a'), row('b')],
      order: ['b', 'a']
    })
    assert.deepEqual(res.tables.profiles.rows, [])
    assert.equal(res.lastDataUpdateTime, 42)
    assert.equal(calls.length, 5, '2 per table + 1 for lastDataUpdateTime')
    assert.deepEqual(
      calls.filter(c => c.op === 'findOne').map(c => c.id),
      ['bookmarks:order', 'profiles:order', 'lastDataUpdateTime']
    )
  })

  test('ignores names that are not real tables', async () => {
    const { calls, dbAction } = makeDb()
    const res = await createLoadInitData(dbAction, tables)(['bookmarks', '__proto__', 'nope'])
    assert.deepEqual(Object.keys(res.tables), ['bookmarks'])
    assert.equal(calls.length, 3)
  })

  test('a bad names argument reads nothing but still replies', async () => {
    const { calls, dbAction } = makeDb()
    const res = await createLoadInitData(dbAction, tables)(null)
    assert.deepEqual(res.tables, {})
    assert.equal(res.lastDataUpdateTime, 42)
    assert.equal(calls.length, 1)
  })

  test('a failed read rejects so the renderer falls back to per-table reads', async () => {
    const dbAction = async () => { throw new Error('SQLITE_CORRUPT') }
    await assert.rejects(
      createLoadInitData(dbAction, tables)(['bookmarks']),
      /SQLITE_CORRUPT/
    )
  })

  test('yields a macrotask between tables so startup IPC is not starved', async () => {
    // dbAction is async but synchronous inside, so a plain Promise.all would
    // keep the main process busy for the whole read. A macrotask queued before
    // the loader must have run by the time it resolves.
    const { dbAction } = makeDb()
    let ticked = false
    setImmediate(() => { ticked = true })
    await createLoadInitData(dbAction, tables)(['bookmarks', 'profiles'])
    assert.equal(ticked, true, 'the event loop must get a turn during the read')
  })

  test('round trip: main payload -> store fields', async () => {
    const { dbAction } = makeDb()
    const res = await createLoadInitData(dbAction, tables)(['bookmarks'])
    assert.deepEqual(buildInitData(res, ['bookmarks']), {
      bookmarks: [
        { id: 'b', title: 'item-b' },
        { id: 'a', title: 'item-a' }
      ],
      lastDataUpdateTime: 42
    })
  })
})
