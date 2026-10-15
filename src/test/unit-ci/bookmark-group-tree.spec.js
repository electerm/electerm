const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let getRootBookmarkGroups
let mapBookmarkGroupTree
let findBookmarkGroupParent

before(async () => {
  const mod = await import('../../client/common/bookmark-group-tree.js')
  getRootBookmarkGroups = mod.getRootBookmarkGroups
  mapBookmarkGroupTree = mod.mapBookmarkGroupTree
  findBookmarkGroupParent = mod.findBookmarkGroupParent
})

// a group as it arrives from an import: `level` is simply absent
const group = (id, extra = {}) => ({ id, title: id, bookmarkIds: [], ...extra })

const rootIds = groups => getRootBookmarkGroups(groups, ['default']).map(g => g.id)

// depth-first ids of a mapped tree, so a duplicate placement is visible
const flatIds = nodes => nodes.reduce((acc, node) => [
  ...acc,
  node.id,
  ...flatIds(node.children || [])
], [])

describe('bookmark group roots', () => {
  test('derives roots from parent references, not from the optional level field', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B'),
      group('C', { bookmarkGroupIds: ['D'] }),
      group('D')
    ]
    // B and D carry no level, and used to be treated as roots as well, which
    // rendered them twice
    assert.deepStrictEqual(rootIds(groups), ['default', 'A', 'C'])
  })

  test('a nested group carrying a stale level is still not a root', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B', { level: 1 })
    ]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('default stays a root even when another group references it', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['default'] })
    ]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('keeps the order the user arranged the roots in', () => {
    const groups = [group('C'), group('default'), group('A')]
    assert.deepStrictEqual(rootIds(groups), ['C', 'default', 'A'])
  })

  test('promotes a group whose parent is gone instead of hiding it', () => {
    // what onDrop leaves behind when a nested group is moved out
    const groups = [group('default'), group('A', { level: 2 })]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('promotes the outermost group of an unreachable cluster, keeping the rest nested', () => {
    // A <-> X is a cycle nothing points at, and B belongs to A
    const groups = [
      group('default'),
      group('B'),
      group('A', { bookmarkGroupIds: ['B', 'X'] }),
      group('X', { bookmarkGroupIds: ['A'] })
    ]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('promotion does not depend on the order the groups arrive in', () => {
    const shape = () => [
      group('A', { bookmarkGroupIds: ['B', 'X'] }),
      group('X', { bookmarkGroupIds: ['A'] }),
      group('B')
    ]
    // both orders must keep B nested under A. Promoting whichever group came
    // first in the array used to flatten the cluster in one of the two orders.
    assert.deepStrictEqual(rootIds([group('default'), ...shape()]), ['default', 'A'])
    assert.deepStrictEqual(rootIds([...shape(), group('default')]), ['default', 'A'])
  })

  test('a self-referencing group terminates and stays reachable', () => {
    const groups = [group('default'), group('A', { bookmarkGroupIds: ['A'] })]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('a cycle below a real root does not add another root', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B', { bookmarkGroupIds: ['A'] })
    ]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('dangling child ids are ignored', () => {
    const groups = [group('default'), group('A', { bookmarkGroupIds: ['ghost'] })]
    assert.deepStrictEqual(rootIds(groups), ['default', 'A'])
  })

  test('an empty or missing list yields no roots', () => {
    assert.deepStrictEqual(getRootBookmarkGroups(), [])
    assert.deepStrictEqual(getRootBookmarkGroups([]), [])
  })
})

describe('mapBookmarkGroupTree', () => {
  const mapper = {
    mapGroup: (g, children) => ({ id: g.id, children })
  }

  test('places every group exactly once', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B')
    ]
    const nodes = mapBookmarkGroupTree(groups, mapper)
    assert.deepStrictEqual(flatIds(nodes), ['default', 'A', 'B'])
  })

  test('interleaves bookmark leaves after the child groups', () => {
    const groups = [
      group('default', { bookmarkGroupIds: ['B'], bookmarkIds: ['b1', 'b2'] }),
      group('B', { bookmarkIds: ['b3'] })
    ]
    const nodes = mapBookmarkGroupTree(groups, {
      ...mapper,
      mapBookmark: id => ({ id, isBookmark: true })
    })
    assert.deepStrictEqual(nodes[0].children.map(n => n.id), ['B', 'b1', 'b2'])
    assert.deepStrictEqual(nodes[0].children[0].children.map(n => n.id), ['b3'])
  })

  test('a group referenced by two parents is placed under the first one only', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['X'] }),
      group('B', { bookmarkGroupIds: ['X'] }),
      group('X')
    ]
    const nodes = mapBookmarkGroupTree(groups, mapper)
    assert.deepStrictEqual(flatIds(nodes), ['default', 'A', 'X', 'B'])
  })

  test('the nodes are safe to use as keys: no group appears twice', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B', 'X'] }),
      group('X', { bookmarkGroupIds: ['A'] }),
      group('B')
    ]
    const ids = flatIds(mapBookmarkGroupTree(groups, mapper))
    assert.deepStrictEqual(ids, [...new Set(ids)])
  })

  test('drops a group the mapper drops, and its subtree with it', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B')
    ]
    const nodes = mapBookmarkGroupTree(groups, {
      mapGroup: (g, children) => g.id === 'A' ? null : { id: g.id, children }
    })
    assert.deepStrictEqual(flatIds(nodes), ['default'])
  })

  test('a missing group reference is skipped rather than throwing', () => {
    const groups = [group('default'), group('A', { bookmarkGroupIds: ['ghost'] })]
    assert.deepStrictEqual(flatIds(mapBookmarkGroupTree(groups, mapper)), ['default', 'A'])
  })

  test('accepts no arguments', () => {
    assert.deepStrictEqual(mapBookmarkGroupTree(), [])
  })
})

describe('findBookmarkGroupParent', () => {
  test('finds the parent by reference, with no level involved', () => {
    const groups = [
      group('default'),
      group('A', { bookmarkGroupIds: ['B'] }),
      group('B')
    ]
    assert.equal(findBookmarkGroupParent(groups, 'B').id, 'A')
  })

  test('returns undefined for a root', () => {
    const groups = [group('default'), group('A', { bookmarkGroupIds: ['B'] }), group('B')]
    assert.equal(findBookmarkGroupParent(groups, 'A'), undefined)
  })

  test('returns undefined when nothing references the id', () => {
    assert.equal(findBookmarkGroupParent([group('default')], 'nope'), undefined)
    assert.equal(findBookmarkGroupParent(), undefined)
  })
})
