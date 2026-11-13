const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let clickRenameDelay
let shouldArmClickRename

before(async () => {
  const mod = await import('../../client/common/click-rename.js')
  clickRenameDelay = mod.clickRenameDelay
  shouldArmClickRename = mod.shouldArmClickRename
})

const file = (id = 'f1', extra = {}) => ({
  id,
  name: 'a.txt',
  type: 'local',
  ...extra
})

const sel = (...ids) => new Set(ids)

describe('shouldArmClickRename', () => {
  test('first click on an unselected row only selects', () => {
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel()
    }), false)
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel('other')
    }), false)
  })

  test('clicking the only selected row arms the rename', () => {
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel('f1')
    }), true)
  })

  test('a multi selection never renames, it collapses first', () => {
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel('f1', 'f2')
    }), false)
  })

  test('modifier clicks are selection changes, not rename', () => {
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel('f1'),
      modifierKey: true
    }), false)
  })

  test('no rename on touch UI, there is no second click there', () => {
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: sel('f1'),
      isMobile: true
    }), false)
  })

  test('placeholder rows are not renameable', () => {
    assert.equal(shouldArmClickRename({
      file: file('f1', { isEmpty: true }),
      selectedIds: sel('f1')
    }), false)
    assert.equal(shouldArmClickRename({
      file: file('f1', { isParent: true }),
      selectedIds: sel('f1')
    }), false)
  })

  test('a row that is already an input is left alone', () => {
    assert.equal(shouldArmClickRename({
      file: file('f1', { isEditing: true }),
      selectedIds: sel('f1')
    }), false)
  })

  test('a row without an id cannot be renamed', () => {
    assert.equal(shouldArmClickRename({
      file: { name: 'new', nameTemp: '' },
      selectedIds: sel(undefined)
    }), false)
  })

  test('missing input is not a rename', () => {
    assert.equal(shouldArmClickRename(), false)
    assert.equal(shouldArmClickRename({ file: file() }), false)
    assert.equal(shouldArmClickRename({
      file: file(),
      selectedIds: ['f1']
    }), false)
  })

  test('the delay is the double-click interval', () => {
    assert.equal(clickRenameDelay, 500)
  })
})
