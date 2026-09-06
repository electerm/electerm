const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadEngine = () => import('../../client/components/terminal/automation/trigger-engine.js')
const loadMatcher = () => import('../../client/components/terminal/automation/stream-matcher.js')
const loadStrip = () => import('../../client/components/terminal/automation/strip-ansi.js')
const loadKeys = () => import('../../client/components/terminal/automation/keys.js')

function rule (over = {}) {
  return {
    id: over.id || 'r1',
    name: 'test',
    enabled: true,
    match: { type: 'text', value: '--More--', caseSensitive: false },
    action: { type: 'send', value: ' ' },
    sendEnter: false,
    mode: 'cooldown',
    cooldownMs: 500,
    ...over
  }
}

describe('trigger-engine', () => {
  test('fires send action on text match with cooldown', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule()])
    eng.push('some output\n--More--\n')
    assert.equal(sent.length, 1)
    assert.equal(sent[0], ' ')
    // same chunk again: cooldown suppresses (buffer still contains match)
    eng.push('x')
    assert.equal(sent.length, 1)
  })

  test('matches split across chunks', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule()])
    eng.push('--Mo')
    assert.equal(sent.length, 0)
    eng.push('re--')
    assert.equal(sent.length, 1)
  })

  test('regex match is case-insensitive by default', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule({
      match: { type: 'regex', value: 'press any key', caseSensitive: false }
    })])
    eng.push('PRESS ANY KEY to continue')
    assert.equal(sent.length, 1)
  })

  test('once mode fires only once', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule({ mode: 'once', cooldownMs: 0 })])
    eng.push('--More--')
    eng.push('--More--')
    eng.push('--More--')
    assert.equal(sent.length, 1)
  })

  test('disabled rules never fire', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule({ enabled: false })])
    eng.push('--More--')
    assert.equal(sent.length, 0)
  })

  test('ansi sequences are stripped before matching', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const esc = String.fromCharCode(27)
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule()])
    eng.push(`${esc}[31m--Mo${esc}[0mre--`)
    assert.equal(sent.length, 1)
  })

  test('sendEnter appends carriage return', async () => {
    const { default: TriggerEngine } = await loadEngine()
    const sent = []
    const eng = new TriggerEngine({ send: (p) => sent.push(p) })
    eng.setTriggers([rule({ action: { type: 'send', value: 'yes' }, sendEnter: true })])
    eng.push('--More--')
    assert.equal(sent[0], 'yes\r')
  })

  test('validateTriggers rejects bad rules', async () => {
    const { validateTriggers } = await loadEngine()
    assert.deepEqual(validateTriggers([{ name: 'x' }]).length, 1)
    assert.deepEqual(validateTriggers([{ match: { type: 'regex', value: '([' } }]).length, 1)
    assert.deepEqual(validateTriggers([rule()]), [])
  })
})

describe('stream-matcher', () => {
  test('resolves waiters across chunk boundary', async () => {
    const { default: StreamMatcher } = await loadMatcher()
    const m = new StreamMatcher()
    const p = m.wait(/hello/, { timeout: 1000 })
    m.push('he')
    m.push('llo')
    const r = await p
    assert.equal(r.text, 'hello')
  })

  test('times out with ETTIMEOUT-like code', async () => {
    const { default: StreamMatcher } = await loadMatcher()
    const m = new StreamMatcher()
    await assert.rejects(
      m.wait(/never/, { timeout: 20 }),
      (e) => e.code === 'ETIMEOUT'
    )
  })
})

describe('strip-ansi and keys', () => {
  test('stripAnsi removes csi sequences', async () => {
    const { stripAnsi } = await loadStrip()
    const esc = String.fromCharCode(27)
    assert.equal(stripAnsi(`${esc}[31mhi${esc}[0m`), 'hi')
  })

  test('expandControlChars handles escapes', async () => {
    const { expandControlChars } = await loadKeys()
    assert.equal(expandControlChars('a\\r\\n\\x41^M'), 'a\r\nA\r')
  })
})
