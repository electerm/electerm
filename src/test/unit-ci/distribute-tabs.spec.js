const { test } = require('node:test')
const assert = require('node:assert/strict')

async function load () {
  const mod = await import('../../client/common/distribute-tabs.js')
  return mod.distributeTabsEvenly
}

function sizes (batches, count) {
  const out = new Array(count).fill(0)
  batches.forEach(b => { out[b]++ })
  return out
}

test('splits tabs evenly, leading panes stay fuller', async () => {
  const distribute = await load()
  assert.deepEqual(distribute(6, 3), [0, 0, 1, 1, 2, 2])
  assert.deepEqual(distribute(5, 3), [0, 0, 1, 1, 2])
  assert.deepEqual(distribute(4, 3), [0, 0, 1, 2])
  assert.deepEqual(distribute(7, 3), [0, 0, 0, 1, 1, 2, 2])
  assert.deepEqual(distribute(6, 4), [0, 0, 1, 1, 2, 3])
  assert.deepEqual(distribute(3, 1), [0, 0, 0])
  assert.deepEqual(distribute(1, 1), [0])
})

test('never leaves a trailing pane empty just because of the remainder', async () => {
  // regression: the original PR chunked with Math.ceil(total / count), so
  // 4 tabs into 3 panes gave 2/2/0 and 6 tabs into 4 panes gave 2/2/2/0
  const distribute = await load()
  assert.deepEqual(sizes(distribute(4, 3), 3), [2, 1, 1])
  assert.deepEqual(sizes(distribute(6, 4), 4), [2, 2, 1, 1])
  assert.deepEqual(sizes(distribute(7, 3), 3), [3, 2, 2])
  assert.deepEqual(sizes(distribute(10, 4), 4), [3, 3, 2, 2])
})

test('leaves panes empty only when there are fewer tabs than panes', async () => {
  const distribute = await load()
  assert.deepEqual(distribute(2, 3), [0, 1])
  assert.deepEqual(distribute(1, 4), [0])
  assert.deepEqual(distribute(0, 4), [])
})

test('handles missing or invalid pane counts', async () => {
  const distribute = await load()
  assert.deepEqual(distribute(3, 0), [0, 0, 0])
  assert.deepEqual(distribute(3, -2), [0, 0, 0])
  assert.deepEqual(distribute(3, undefined), [0, 0, 0])
  assert.deepEqual(distribute(3, 2.7), [0, 0, 1])
})

test('panes never differ by more than one tab', async () => {
  const distribute = await load()
  for (let total = 0; total <= 24; total++) {
    for (let count = 1; count <= 4; count++) {
      const batches = distribute(total, count)
      assert.equal(batches.length, total)
      const s = sizes(batches, count)
      assert.ok(Math.max(...s) - Math.min(...s) <= 1)
    }
  }
})
