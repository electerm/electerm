const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let parseBookmarkImport
let collectUncategorizedBookmarks

before(async () => {
  const mod = await import('../../client/common/parse-bookmark-import.js')
  parseBookmarkImport = mod.default
  const uncategorized = await import('../../client/common/bookmark-uncategorized.js')
  collectUncategorizedBookmarks = uncategorized.collectUncategorizedBookmarks
})

const bookmark = (id, extra = {}) => ({ id, title: id, host: id + '.example.com', ...extra })

describe('parseBookmarkImport', () => {
  test('a bare bookmark array imports as uncategorized bookmarks', () => {
    const arr = [bookmark('a'), bookmark('b')]
    const { bookmarks, bookmarkGroups } = parseBookmarkImport(arr)
    assert.deepStrictEqual(bookmarks, arr)
    assert.deepStrictEqual(bookmarkGroups, [])
    // and the sweep turns all of them into one category
    const group = collectUncategorizedBookmarks(bookmarks, bookmarkGroups, { stamp: 's' })
    assert.deepStrictEqual(group.bookmarkIds, ['a', 'b'])
  })

  test('a { bookmarks, bookmarkGroups } object keeps the categories', () => {
    const groups = [{ id: 'g1', title: 'g1', bookmarkIds: ['a'], bookmarkGroupIds: [] }]
    const { bookmarks, bookmarkGroups } = parseBookmarkImport({
      bookmarks: [bookmark('a'), bookmark('b')],
      bookmarkGroups: groups
    })
    assert.equal(bookmarks.length, 2)
    assert.deepStrictEqual(bookmarkGroups, groups)
    const created = collectUncategorizedBookmarks(bookmarks, bookmarkGroups, { stamp: 's' })
    assert.deepStrictEqual(created.bookmarkIds, ['b'])
  })

  test('a wrapper without a bookmarkGroups array still imports its bookmarks', () => {
    const { bookmarks, bookmarkGroups } = parseBookmarkImport({
      bookmarks: [bookmark('a')]
    })
    assert.equal(bookmarks.length, 1)
    assert.deepStrictEqual(bookmarkGroups, [])
  })

  test('a single bookmark object imports as one uncategorized bookmark', () => {
    const one = bookmark('only')
    const { bookmarks, bookmarkGroups } = parseBookmarkImport(one)
    assert.deepStrictEqual(bookmarks, [one])
    assert.deepStrictEqual(bookmarkGroups, [])
    const group = collectUncategorizedBookmarks(bookmarks, bookmarkGroups, { stamp: 's' })
    assert.deepStrictEqual(group.bookmarkIds, ['only'])
  })

  test('a single serial or web bookmark is recognized too', () => {
    const serial = { id: 's1', title: 'com3', path: 'COM3', type: 'serial' }
    assert.deepStrictEqual(parseBookmarkImport(serial).bookmarks, [serial])
    const web = { id: 'w1', title: 'router', url: 'http://192.168.1.1', type: 'web' }
    assert.deepStrictEqual(parseBookmarkImport(web).bookmarks, [web])
  })

  test('an object that is not bookmarks is reported instead of importing nothing', () => {
    assert.throws(() => parseBookmarkImport({}), /Unsupported bookmarks file/)
    assert.throws(() => parseBookmarkImport({ config: {} }), /Unsupported bookmarks file/)
    // an empty wrapper is a container, not a bookmark, and imports nothing
    assert.deepStrictEqual(
      parseBookmarkImport({ bookmarks: [] }),
      { bookmarks: [], bookmarkGroups: [] }
    )
  })

  test('a non-object payload is reported', () => {
    assert.throws(() => parseBookmarkImport('bookmarks.json'), /Unsupported bookmarks file/)
    assert.throws(() => parseBookmarkImport(null), /Unsupported bookmarks file/)
    assert.throws(() => parseBookmarkImport(42), /Unsupported bookmarks file/)
  })
})
