const { describe, test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

// The addon talks to the clipboard through the renderer global `window.pre`.
// Both halves are spied so a test can tell a write from a read.
const calls = { read: 0, written: [] }

global.window = global.window || {}
global.window.pre = {
  readClipboard () {
    calls.read += 1
    return 'super-secret-token'
  },
  writeClipboard (str) {
    calls.written.push(str)
  }
}

const loadAddon = () => import('../../client/components/terminal/osc52-addon.js')

// Minimal stand-in for the xterm parser: hands back the OSC handler the addon
// registers so a test can feed it the payload that follows "ESC ] 52 ;".
function fakeTerminal () {
  const handlers = {}
  return {
    handlers,
    parser: {
      registerOscHandler (code, fn) {
        handlers[code] = fn
        return { dispose () {} }
      }
    }
  }
}

async function addonOn (term) {
  const { Osc52Addon } = await loadAddon()
  const addon = new Osc52Addon()
  addon.activate(term)
  return addon
}

const b64 = str => Buffer.from(str, 'utf8').toString('base64')

describe('OSC 52 clipboard addon', () => {
  beforeEach(() => {
    calls.read = 0
    calls.written.length = 0
  })

  test('registers an OSC 52 handler', async () => {
    const term = fakeTerminal()
    await addonOn(term)
    assert.equal(typeof term.handlers[52], 'function')
  })

  test('a read request never touches the local clipboard', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    // ESC ] 52 ; c ; ? BEL
    const handled = term.handlers[52]('c;?')

    assert.equal(calls.read, 0, 'server must not be able to read the clipboard')
    assert.equal(calls.written.length, 0)
    assert.equal(handled, true, 'sequence is consumed, not passed on')
  })

  test('the read refusal cannot be talked around by selection target or casing', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    for (const data of ['c;?', ';?', 'cp;?', 'p;?', 'c;?;?', 'c;? ']) {
      term.handlers[52](data)
    }

    assert.equal(calls.read, 0)
  })

  test('a write request reaches the clipboard, UTF-8 intact', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    term.handlers[52](`c;${b64('pässword — 密码')}`)

    assert.deepEqual(calls.written, ['pässword — 密码'])
    assert.equal(calls.read, 0)
  })

  test('tmux sends an empty selection target and must still write', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    // ESC ] 52 ; ; <base64> BEL - mouse copy under `set -g mouse on`
    term.handlers[52](`;${b64('copied in tmux')}`)

    assert.deepEqual(calls.written, ['copied in tmux'])
  })

  test('non-clipboard targets are ignored', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    assert.equal(term.handlers[52](`p;${b64('primary selection')}`), false)
    assert.deepEqual(calls.written, [])
  })

  test('malformed payloads do not throw', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    assert.doesNotThrow(() => term.handlers[52]('c;not!valid!base64'))
    assert.doesNotThrow(() => term.handlers[52]('c'))
    assert.doesNotThrow(() => term.handlers[52](''))
  })

  test('an empty write leaves the clipboard alone', async () => {
    const term = fakeTerminal()
    await addonOn(term)

    term.handlers[52]('c;')

    assert.deepEqual(calls.written, [])
  })
})
