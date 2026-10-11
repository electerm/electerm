const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/common/quick-command-groups.js')

const qm = (id, labels) => ({ id, name: id, labels })
const shape = groups => groups.map(g => [g.label, g.items.map(q => q.id)])

describe('group quick commands by label', () => {
  test('labels sort by name, with no label last', async () => {
    const { groupByLabel } = await load()
    const groups = groupByLabel([
      qm('a', ['moxa']),
      qm('b', []),
      qm('c', ['Cisco']),
      qm('d'),
      qm('e', ['hirschmann', 'cisco2'])
    ])
    assert.deepEqual(shape(groups), [
      ['Cisco', ['c']],
      ['cisco2', ['e']],
      ['hirschmann', ['e']],
      ['moxa', ['a']],
      ['', ['b', 'd']]
    ])
  })

  test('keeps the order of the list inside a group', async () => {
    const { groupByLabel } = await load()
    const groups = groupByLabel([qm('z', ['x']), qm('a', ['x']), qm('m', ['x'])])
    assert.deepEqual(shape(groups), [['x', ['z', 'a', 'm']]])
  })

  test('numbers in labels sort as numbers', async () => {
    const { groupByLabel } = await load()
    const groups = groupByLabel([qm('a', ['vlan10']), qm('b', ['vlan9'])])
    assert.deepEqual(groups.map(g => g.label), ['vlan9', 'vlan10'])
  })

  test('a label repeated on one quick command counts once', async () => {
    const { groupByLabel } = await load()
    const groups = groupByLabel([qm('a', ['x', 'x', ''])])
    assert.deepEqual(shape(groups), [['x', ['a']]])
  })

  test('with a label filter, only those groups show', async () => {
    const { groupByLabel } = await load()
    const list = [qm('a', ['cisco', 'recorded']), qm('b', ['moxa']), qm('c', [])]
    assert.deepEqual(shape(groupByLabel(list, ['cisco'])), [['cisco', ['a']]])
    assert.deepEqual(shape(groupByLabel(list, ['moxa', 'cisco'])), [['cisco', ['a']], ['moxa', ['b']]])
  })

  test('hasLabels is false when nothing has a label', async () => {
    const { hasLabels } = await load()
    assert.equal(hasLabels([qm('a'), qm('b', []), qm('c', [''])]), false)
    assert.equal(hasLabels([qm('a'), qm('b', ['x'])]), true)
  })
})
