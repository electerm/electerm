const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let formatBookmarkGroups

before(async () => {
  const mod = await import(
    '../../client/components/bookmark-form/common/bookmark-group-tree-format.js'
  )
  formatBookmarkGroups = mod.default
})

const group = (id, extra = {}) => ({ id, title: id, bookmarkIds: [], ...extra })

const flatKeys = nodes => nodes.reduce((acc, node) => [
  ...acc,
  node.key,
  ...flatKeys(node.children || [])
], [])

describe('bookmark group tree format', () => {
  test('a level-less nested group is not listed as a root as well', () => {
    // the reported bug: imported groups carry no `level`, so the old
    // `level === 1 || !level` filter made B both a root and A's child
    const tree = formatBookmarkGroups([
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B')
    ])
    assert.deepStrictEqual(tree.map(n => n.title), ['default', 'A'])
    assert.deepStrictEqual(tree[1].children.map(n => n.title), ['B'])
    assert.deepStrictEqual(flatKeys(tree), ['default', 'A', 'B'])
  })

  test('never emits the same group twice, whatever the shape', () => {
    const shapes = [
      [group('default'), group('A', { bookmarkGroupIds: ['B'] }), group('B')],
      [group('default'), group('A', { bookmarkGroupIds: ['B'] }), group('B', { level: 2 })],
      [group('default'), group('B'), group('A', { bookmarkGroupIds: ['B', 'X'] }), group('X', { bookmarkGroupIds: ['A'] })],
      [group('default'), group('A', { bookmarkGroupIds: ['A'] })],
      [group('default'), group('A', { level: 2 })],
      [group('default'), group('A', { bookmarkGroupIds: ['B'] }), group('B', { bookmarkGroupIds: ['C'] }), group('C')]
    ]
    for (const groups of shapes) {
      const keys = flatKeys(formatBookmarkGroups(groups))
      assert.deepStrictEqual(
        keys,
        [...new Set(keys)],
        'duplicate key for ' + JSON.stringify(groups.map(g => g.id))
      )
    }
  })

  test('nests deeper levels rather than flattening them', () => {
    const tree = formatBookmarkGroups([
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B', { bookmarkGroupIds: ['C'] }),
      group('C')
    ])
    assert.deepStrictEqual(flatKeys(tree), ['default', 'A', 'B', 'C'])
    assert.deepStrictEqual(tree[1].children[0].children.map(n => n.title), ['C'])
  })

  test('keeps empty groups: this tree picks a target, not a bookmark', () => {
    const tree = formatBookmarkGroups([group('default'), group('A'), group('B')])
    assert.deepStrictEqual(tree.map(n => n.title), ['default', 'A', 'B'])
    assert.equal('children' in tree[0], false)
  })

  test('a group whose parent is gone is still reachable', () => {
    const tree = formatBookmarkGroups([group('default'), group('A', { level: 2 })])
    assert.deepStrictEqual(tree.map(n => n.title), ['default', 'A'])
  })

  test('marks the disabled and current-parent groups', () => {
    const tree = formatBookmarkGroups(
      [group('default'), group('A'), group('B')],
      'A',
      false,
      'B'
    )
    assert.deepStrictEqual(
      tree.map(n => [n.title, n.disabled]),
      [['default', false], ['A', true], ['B', true]]
    )
  })

  test('returnMap hands back the id -> group map as well', () => {
    const groups = [group('default'), group('A')]
    const [tree, map] = formatBookmarkGroups(groups, '', true)
    assert.deepStrictEqual(tree.map(n => n.title), ['default', 'A'])
    assert.equal(map.get('A'), groups[1])
  })

  test('an empty or missing list yields an empty tree', () => {
    assert.deepStrictEqual(formatBookmarkGroups([]), [])
    assert.deepStrictEqual(formatBookmarkGroups(), [])
  })
})
