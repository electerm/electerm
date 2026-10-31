const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let buildBarItems

before(async () => {
  const mod = await import('../../client/components/bookmark-bar/build-bar-items.js')
  buildBarItems = mod.buildBarItems
})

const group = (id, extra = {}) => ({ id, title: id, bookmarkIds: [], ...extra })
const bookmark = id => ({ id, title: id, host: 'h', port: 22, username: 'u' })

// the shape the bar renders: 'bookmark:<id>' / 'group:<id>', nested
const flat = items => items.reduce((acc, item) => [
  ...acc,
  item.key,
  ...flat(item.children || [])
], [])

const build = (groups, bookmarks = []) => buildBarItems({
  bookmarkGroups: groups,
  bookmarksMap: new Map(bookmarks.map(b => [b.id, b])),
  defaultGroupId: 'default'
})

describe('bookmark bar items', () => {
  test('expands the default group inline instead of hiding it in a folder', () => {
    const groups = [
      group('default', {
        bookmarkIds: ['b1', 'b2'],
        bookmarkGroupIds: ['g1']
      }),
      group('g1', { bookmarkIds: ['b3'] })
    ]
    const bookmarks = ['b1', 'b2', 'b3'].map(bookmark)
    assert.deepEqual(flat(build(groups, bookmarks)), [
      'group:g1',
      'bookmark:b3',
      'bookmark:b1',
      'bookmark:b2'
    ])
  })

  test('keeps every other root group as a folder', () => {
    const groups = [
      group('default', { bookmarkIds: ['b1'] }),
      group('prod', { bookmarkIds: ['b2'] })
    ]
    const items = build(groups, [bookmark('b1'), bookmark('b2')])
    assert.deepEqual(items.map(item => item.key), ['bookmark:b1', 'group:prod'])
    assert.equal(items[1].type, 'group')
    assert.deepEqual(items[1].children.map(item => item.key), ['bookmark:b2'])
  })

  test('nests folders inside folders', () => {
    const groups = [
      group('default', { bookmarkGroupIds: ['a'] }),
      group('a', { bookmarkGroupIds: ['b'] }),
      group('b', { bookmarkIds: ['b1'] })
    ]
    const items = build(groups, [bookmark('b1')])
    assert.deepEqual(flat(items), ['group:a', 'group:b', 'bookmark:b1'])
  })

  test('drops bookmark references that no longer resolve', () => {
    const groups = [group('default', { bookmarkIds: ['gone', 'b1'] })]
    assert.deepEqual(flat(build(groups, [bookmark('b1')])), ['bookmark:b1'])
  })

  test('places a bookmark referenced from two groups only once', () => {
    // imported data does this; a duplicate key is a React warning and makes the
    // wrong menu item open
    const groups = [
      group('default', { bookmarkIds: ['b1'] }),
      group('prod', { bookmarkIds: ['b1'] })
    ]
    assert.deepEqual(flat(build(groups, [bookmark('b1')])), [
      'bookmark:b1',
      'group:prod'
    ])
  })

  test('survives a group cycle', () => {
    const groups = [
      group('default', { bookmarkGroupIds: ['a'] }),
      group('a', { bookmarkGroupIds: ['b'] }),
      group('b', { bookmarkGroupIds: ['a'], bookmarkIds: ['b1'] })
    ]
    assert.deepEqual(flat(build(groups, [bookmark('b1')])), [
      'group:a',
      'group:b',
      'bookmark:b1'
    ])
  })

  test('returns nothing for an empty tree', () => {
    assert.deepEqual(build([]), [])
  })
})
