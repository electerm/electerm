const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let getBookmarkType
let getBookmarkPort
let normalizeBookmarkExportFilter
let filterBookmarksForExport
let describeBookmarkExportFilter
let buildBookmarkExportPayload

before(async () => {
  const mod = await import('../../client/common/bookmark-export-filter.js')
  getBookmarkType = mod.getBookmarkType
  getBookmarkPort = mod.getBookmarkPort
  normalizeBookmarkExportFilter = mod.normalizeBookmarkExportFilter
  filterBookmarksForExport = mod.filterBookmarksForExport
  describeBookmarkExportFilter = mod.describeBookmarkExportFilter
  buildBookmarkExportPayload = mod.buildBookmarkExportPayload
})

const ssh = (id, extra = {}) => ({
  id,
  title: id,
  host: id + '.example.com',
  username: 'root',
  ...extra
})

describe('getBookmarkType', () => {
  test('old bookmarks without a type fall back to the field they carry', () => {
    assert.equal(getBookmarkType(ssh('a')), 'ssh')
    assert.equal(getBookmarkType({ id: 'b', path: '/dev/ttyUSB0' }), 'serial')
    assert.equal(getBookmarkType({ id: 'c', url: 'https://example.com' }), 'web')
    assert.equal(getBookmarkType({ id: 'd', title: 'd' }), 'local')
  })

  test('an explicit type wins', () => {
    assert.equal(getBookmarkType(ssh('a', { type: 'vnc' })), 'vnc')
  })
})

describe('getBookmarkPort', () => {
  test('default port is filled in when the bookmark leaves it empty', () => {
    assert.equal(getBookmarkPort(ssh('a')), 22)
    assert.equal(getBookmarkPort(ssh('a', { port: 2222 })), 2222)
    assert.equal(getBookmarkPort({ id: 'b', type: 'local' }), null)
  })
})

describe('normalizeBookmarkExportFilter', () => {
  test('type and types merge, and "any" means no constraint', () => {
    const f = normalizeBookmarkExportFilter({ type: 'ssh', types: ['SSH', 'ftp'] })
    assert.deepStrictEqual(f.types, ['ssh', 'ftp'])
    assert.deepStrictEqual(normalizeBookmarkExportFilter({ type: 'any' }).types, [])
    assert.deepStrictEqual(normalizeBookmarkExportFilter({}).types, [])
  })

  test('missing booleans stay unconstrained, explicit ones do not', () => {
    assert.equal(normalizeBookmarkExportFilter({}).hasPrivateKey, null)
    assert.equal(normalizeBookmarkExportFilter({ hasPrivateKey: false }).hasPrivateKey, false)
  })
})

describe('filterBookmarksForExport', () => {
  const bookmarks = [
    ssh('key', { privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----' }),
    ssh('keypath', { privateKeyPath: '/home/zxd/.ssh/id_ed25519' }),
    ssh('password', { password: 'hunter2' }),
    { id: 'web', type: 'web', title: 'web', url: 'https://example.com' }
  ]

  test('"ssh bookmarks with a private key" matches content and path', () => {
    const { ids, byType, total } = filterBookmarksForExport(bookmarks, [], {
      type: 'ssh',
      hasPrivateKey: true
    })
    assert.deepStrictEqual(ids, ['key', 'keypath'])
    assert.deepStrictEqual(byType, { ssh: 2 })
    assert.equal(total, 2)
  })

  test('without a type, the same flag matches across types', () => {
    const { ids } = filterBookmarksForExport(bookmarks, [], { hasPrivateKey: false })
    assert.deepStrictEqual(ids, ['password', 'web'])
  })

  test('port matches the effective port', () => {
    const { ids } = filterBookmarksForExport(bookmarks, [], { port: 22 })
    assert.deepStrictEqual(ids, ['key', 'keypath', 'password'])
  })

  test('keyword searches the identifying fields only', () => {
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, [], { keyword: 'EXAMPLE.COM' }).ids,
      ['key', 'keypath', 'password', 'web']
    )
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, [], { keyword: 'hunter2' }).ids,
      []
    )
  })

  test('group matches the category title or id', () => {
    const groups = [
      { id: 'g1', title: 'Production', bookmarkIds: ['key'], bookmarkGroupIds: [] }
    ]
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, groups, { group: 'production' }).ids,
      ['key']
    )
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, groups, { group: 'g1' }).ids,
      ['key']
    )
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, groups, { group: 'nope' }).ids,
      []
    )
  })

  test('ids pick exactly what was asked for', () => {
    assert.deepStrictEqual(
      filterBookmarksForExport(bookmarks, [], { ids: ['web', 'gone'] }).ids,
      ['web']
    )
  })

  test('nothing matching is an empty result, not an error', () => {
    const r = filterBookmarksForExport(bookmarks, [], { type: 'serial' })
    assert.deepStrictEqual(r.ids, [])
    assert.equal(r.total, 0)
  })
})

describe('describeBookmarkExportFilter', () => {
  test('reads back as the request a user made', () => {
    const text = describeBookmarkExportFilter({ type: 'ssh', hasPrivateKey: true })
    assert.match(text, /ssh/)
    assert.match(text, /with private key/)
  })

  test('an empty filter is any type', () => {
    assert.equal(describeBookmarkExportFilter({}), 'any type')
  })
})

describe('buildBookmarkExportPayload', () => {
  const bookmarks = [ssh('a'), ssh('b'), ssh('c')]
  const groups = [
    { id: 'root', title: 'root', bookmarkIds: [], bookmarkGroupIds: ['child'] },
    { id: 'child', title: 'child', bookmarkIds: ['a', 'b'], bookmarkGroupIds: [] },
    { id: 'other', title: 'other', bookmarkIds: ['c'], bookmarkGroupIds: [] }
  ]

  test('only the selected bookmarks are written', () => {
    const { bookmarks: out } = buildBookmarkExportPayload(bookmarks, groups, ['a'])
    assert.deepStrictEqual(out.map(b => b.id), ['a'])
  })

  test('the owning category and its ancestors are kept, narrowed to the selection', () => {
    const { bookmarkGroups } = buildBookmarkExportPayload(bookmarks, groups, ['a'])
    assert.deepStrictEqual(bookmarkGroups.map(g => g.id), ['root', 'child'])
    assert.deepStrictEqual(bookmarkGroups[1].bookmarkIds, ['a'])
    // the parent still references the child, so the tree nests on import
    assert.deepStrictEqual(bookmarkGroups[0].bookmarkGroupIds, ['child'])
  })

  test('categories holding nothing selected are dropped', () => {
    const { bookmarkGroups } = buildBookmarkExportPayload(bookmarks, groups, ['c'])
    assert.deepStrictEqual(bookmarkGroups.map(g => g.id), ['other'])
  })

  test('a cycle between categories does not hang', () => {
    const cyclic = [
      { id: 'x', title: 'x', bookmarkIds: ['a'], bookmarkGroupIds: ['y'] },
      { id: 'y', title: 'y', bookmarkIds: [], bookmarkGroupIds: ['x'] }
    ]
    const { bookmarkGroups } = buildBookmarkExportPayload(bookmarks, cyclic, ['a'])
    assert.deepStrictEqual(bookmarkGroups.map(g => g.id).sort(), ['x', 'y'])
  })
})
