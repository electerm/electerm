const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let getSourceBookmark

before(async () => {
  const mod = await import('../../client/common/get-source-bookmark.js')
  getSourceBookmark = mod.default
})

const bookmark = { id: 'bm1', host: 'example.com', username: 'u' }
const store = {
  bookmarks: [bookmark],
  bookmarksMap: new Map([[bookmark.id, bookmark]])
}

describe('getSourceBookmark', () => {
  test('resolves a bookmark tab from bookmarksMap', () => {
    const item = getSourceBookmark({
      from: 'bookmarks',
      srcId: 'bm1'
    }, store)
    assert.equal(item, bookmark)
  })

  test('falls back to bookmarks array when map misses', () => {
    const item = getSourceBookmark({
      from: 'bookmarks',
      srcId: 'bm1'
    }, {
      bookmarks: [bookmark],
      bookmarksMap: new Map()
    })
    assert.equal(item, bookmark)
  })

  test('returns undefined for quick connect tabs', () => {
    assert.equal(getSourceBookmark({
      from: 'quickConnect',
      host: 'example.com'
    }, store), undefined)
  })

  test('returns undefined when srcId is missing', () => {
    assert.equal(getSourceBookmark({ from: 'bookmarks' }, store), undefined)
  })

  test('returns undefined when the source bookmark was deleted', () => {
    assert.equal(getSourceBookmark({
      from: 'bookmarks',
      srcId: 'missing'
    }, store), undefined)
  })

  test('returns undefined for missing item or store', () => {
    assert.equal(getSourceBookmark(undefined, store), undefined)
    assert.equal(getSourceBookmark({ from: 'bookmarks', srcId: 'bm1' }), undefined)
  })
})
