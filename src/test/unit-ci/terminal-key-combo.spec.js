/**
 * terminal-key-combo: the shortcut string a key event maps to, and the one
 * rule the terminal applies on top of it — inside the alternate buffer a
 * full-screen app (tmux, vim, less) keeps bare Ctrl+V, so only an explicit
 * variant such as Ctrl+Shift+V pastes there (#4656, and #3115 for why Ctrl+V
 * must stay with vim).
 */

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = async () => import(
  '../../client/components/shortcuts/terminal-key-combo.js'
)

const key = (init = {}) => ({
  type: 'keydown',
  code: 'KeyV',
  key: 'v',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...init
})

describe('getKeyCombo', () => {
  test('maps modifier + key to the config string', async () => {
    const { getKeyCombo } = await load()
    assert.equal(getKeyCombo(key({ ctrlKey: true })), 'ctrl+v')
    assert.equal(getKeyCombo(key({ ctrlKey: true, shiftKey: true })), 'ctrl+shift+v')
    assert.equal(getKeyCombo(key({ metaKey: true })), 'meta+v')
  })

  test('a key with no modifier belongs to the program, not a shortcut', async () => {
    const { getKeyCombo } = await load()
    assert.equal(getKeyCombo(key()), '')
    assert.equal(getKeyCombo(key({ key: 'Enter', code: 'Enter' })), '')
  })

  test('named keys use the same characters the config uses', async () => {
    const { getKeyCombo } = await load()
    assert.equal(
      getKeyCombo(key({ code: 'ArrowUp', key: 'ArrowUp', metaKey: true })),
      'meta+↑'
    )
    assert.equal(
      getKeyCombo(key({ code: 'BracketLeft', key: '[', ctrlKey: true })),
      'ctrl+['
    )
  })

  test('middle click is the wheel shortcut', async () => {
    const { getKeyCombo } = await load()
    assert.equal(
      getKeyCombo({ type: 'mousedown', button: 1 }),
      'mouseWheel'
    )
  })
})

describe('matchesShortcut', () => {
  test('a shortcut can list several combos', async () => {
    const { matchesShortcut } = await load()
    assert.equal(matchesShortcut('ctrl+shift+v', 'ctrl+v,ctrl+shift+v'), true)
    assert.equal(matchesShortcut('ctrl+v', 'ctrl+v,ctrl+shift+v'), true)
    assert.equal(matchesShortcut('ctrl+c', 'ctrl+v,ctrl+shift+v'), false)
  })

  test('an unbound shortcut matches nothing', async () => {
    const { matchesShortcut } = await load()
    assert.equal(matchesShortcut('', ''), false)
    assert.equal(matchesShortcut('ctrl+v', ''), false)
  })
})

describe('isAltBufferPasteCombo', () => {
  const PASTE = 'ctrl+v,ctrl+shift+v'

  test('bare Ctrl+V stays with the full-screen app', async () => {
    const { isAltBufferPasteCombo } = await load()
    assert.equal(isAltBufferPasteCombo('ctrl+v', PASTE, false), false)
  })

  test('Ctrl+Shift+V is paste', async () => {
    const { isAltBufferPasteCombo } = await load()
    assert.equal(isAltBufferPasteCombo('ctrl+shift+v', PASTE, false), true)
  })

  test('a combo that is not the paste shortcut is never paste', async () => {
    const { isAltBufferPasteCombo } = await load()
    assert.equal(isAltBufferPasteCombo('ctrl+shift+c', PASTE, false), false)
    assert.equal(isAltBufferPasteCombo('', PASTE, false), false)
  })

  test('on macOS Cmd+V is paste — xterm sends no key for it', async () => {
    const { isAltBufferPasteCombo } = await load()
    assert.equal(isAltBufferPasteCombo('meta+v', 'meta+v', true), true)
  })
})
