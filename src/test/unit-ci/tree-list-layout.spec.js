const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let treeLevelIndent
let maxTreeIndentSteps
let treeIndentSteps
let treeIndentPx
let treeGroupPaddingPx
let isTreeIndentCapped

before(async () => {
  const mod = await import('../../client/components/tree-list/tree-list-layout.js')
  treeLevelIndent = mod.treeLevelIndent
  maxTreeIndentSteps = mod.maxTreeIndentSteps
  treeIndentSteps = mod.treeIndentSteps
  treeIndentPx = mod.treeIndentPx
  treeGroupPaddingPx = mod.treeGroupPaddingPx
  isTreeIndentCapped = mod.isTreeIndentCapped
})

describe('tree indent cap', () => {
  test('indents one step per level below the cap', () => {
    for (let depth = 0; depth <= maxTreeIndentSteps; depth++) {
      assert.equal(treeIndentSteps(depth), depth)
      assert.equal(treeIndentPx(depth), depth * treeLevelIndent)
    }
  })

  test('stops indenting at the cap', () => {
    const ceiling = maxTreeIndentSteps * treeLevelIndent
    for (const depth of [maxTreeIndentSteps + 1, 9, 30]) {
      assert.equal(treeIndentPx(depth), ceiling)
    }
  })

  test('flags only the rows the cap actually stopped', () => {
    assert.equal(isTreeIndentCapped(maxTreeIndentSteps), false)
    assert.equal(isTreeIndentCapped(maxTreeIndentSteps + 1), true)
  })

  test('group rows keep their pre-cap offset, expander column included', () => {
    for (let depth = 0; depth <= maxTreeIndentSteps; depth++) {
      assert.equal(
        treeGroupPaddingPx(depth),
        Math.max(0, (depth - 1) * treeLevelIndent)
      )
    }
    // the expander column is added back by .tree-list-row-group, so a capped
    // group still lands on the same ceiling as a capped bookmark
    assert.equal(
      treeGroupPaddingPx(20) + treeLevelIndent,
      treeIndentPx(20)
    )
  })

  test('never returns a negative offset', () => {
    assert.equal(treeIndentPx(-3), 0)
    assert.equal(treeGroupPaddingPx(0), 0)
    assert.equal(treeGroupPaddingPx(-3), 0)
  })
})
