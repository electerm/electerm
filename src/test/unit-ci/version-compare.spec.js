const { test } = require('node:test')
const assert = require('node:assert/strict')
const compare = require('../../app/common/version-compare')

test('compares versions part by part', () => {
  assert.equal(compare('1.0.0', '12.0.3'), -1)
  assert.equal(compare('12.0.3', '1.0.0'), 1)
  assert.equal(compare('1.34.59', '1.34.59'), 0)
  assert.equal(compare('v1.2.10', '1.2.9'), 1)
})

test('a version with more parts is compared on all of them', () => {
  assert.equal(compare('1.0', '1.0.1'), -1)
  assert.equal(compare('1.0.1', '1.0'), 1)
  assert.equal(compare('1.0.0', '1.0'), 0)
  assert.equal(compare('2', '1.9.9'), 1)
})
