const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let collectUncategorizedBookmarks
let uncategorizedBookmarkGroupPrefix
let getRootBookmarkGroups

before(async () => {
  const mod = await import('../../client/common/bookmark-uncategorized.js')
  collectUncategorizedBookmarks = mod.collectUncategorizedBookmarks
  uncategorizedBookmarkGroupPrefix = mod.uncategorizedBookmarkGroupPrefix
  const tree = await import('../../client/common/bookmark-group-tree.js')
  getRootBookmarkGroups = tree.getRootBookmarkGroups
})

const bm = id => ({ id, title: id })
const group = (id, extra = {}) => ({ id, title: id, bookmarkIds: [], ...extra })

describe('collectUncategorizedBookmarks', () => {
  test('sweeps bookmarks no category references into one new category', () => {
    const bookmarks = [bm('a'), bm('b'), bm('c')]
    const groups = [
      group('default', { bookmarkIds: ['a'] }),
      // a group imported from another client often carries no bookmarkIds
      { id: 'g2', title: 'g2' }
    ]
    const created = collectUncategorizedBookmarks(bookmarks, groups, {
      stamp: '2026-11-05-11-40-01'
    })
    assert.equal(created.title, 'uncategory-bookmarks-2026-11-05-11-40-01')
    assert.deepStrictEqual(created.bookmarkIds, ['b', 'c'])
    assert.deepStrictEqual(created.bookmarkGroupIds, [])
    assert.equal(groups.length, 3)
    assert.equal(groups[2], created)
    // categorized bookmarks are left where they are
    assert.deepStrictEqual(groups[0].bookmarkIds, ['a'])
  })

  test('the new category is a root, so the bookmarks show up in the tree', () => {
    const bookmarks = [bm('a')]
    const groups = [group('default')]
    const created = collectUncategorizedBookmarks(bookmarks, groups, { stamp: 's' })
    const roots = getRootBookmarkGroups(groups, ['default']).map(g => g.id)
    assert.ok(roots.includes(created.id))
  })

  test('creates nothing when every bookmark is already categorized', () => {
    const bookmarks = [bm('a'), bm('b')]
    const groups = [group('default', { bookmarkIds: ['a', 'b'] })]
    const created = collectUncategorizedBookmarks(bookmarks, groups, { stamp: 's' })
    assert.equal(created, null)
    assert.equal(groups.length, 1)
  })

  test('an empty import does not create an empty category', () => {
    const groups = [group('default')]
    assert.equal(collectUncategorizedBookmarks([], groups, { stamp: 's' }), null)
    assert.equal(groups.length, 1)
  })

  test('an id listed twice appears once in the new category', () => {
    const bookmarks = [bm('a'), bm('a')]
    const created = collectUncategorizedBookmarks(bookmarks, [], { stamp: 's' })
    assert.deepStrictEqual(created.bookmarkIds, ['a'])
  })

  test('a bookmark without an id cannot be referenced, so it is skipped', () => {
    const bookmarks = [{ title: 'broken' }, bm('a')]
    const created = collectUncategorizedBookmarks(bookmarks, [], { stamp: 's' })
    assert.deepStrictEqual(created.bookmarkIds, ['a'])
  })

  test('each import gets its own category instead of extending an older one', () => {
    const groups = []
    const first = collectUncategorizedBookmarks([bm('a')], groups, { stamp: 'one' })
    const second = collectUncategorizedBookmarks([bm('a'), bm('b')], groups, { stamp: 'two' })
    assert.equal(groups.length, 2)
    assert.deepStrictEqual(first.bookmarkIds, ['a'])
    assert.deepStrictEqual(second.bookmarkIds, ['b'])
    assert.ok(second.title.startsWith(uncategorizedBookmarkGroupPrefix))
  })
})
