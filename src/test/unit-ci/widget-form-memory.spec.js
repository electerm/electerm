const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

// The pure half of what a widget form remembers between visits
// (client/common/widget-form-memory-utils.js). The storage glue next to it is a
// thin read/write of the same rules, exercised by e2e/0100.widget-config-mode.

let pickRemembered
let mergeRemembered
let widgetConfigKey

const CONFIGS = [
  { name: 'host', type: 'string' },
  { name: 'port', type: 'number' },
  { name: 'passphrase', type: 'password' },
  { name: 'apiKey', type: 'string', showGenerator: true }
]

before(async () => {
  const mod = await import('../../client/common/widget-form-memory-utils.js')
  pickRemembered = mod.pickRemembered
  mergeRemembered = mod.mergeRemembered
  widgetConfigKey = mod.widgetConfigKey
})

describe('widget form memory', () => {
  test('keeps the declared values and hands them back', () => {
    const stored = mergeRemembered(CONFIGS, { host: 'demo.local', port: 22 }, {})
    assert.deepStrictEqual(stored, { host: 'demo.local', port: 22 })
    assert.deepStrictEqual(pickRemembered(CONFIGS, stored), { host: 'demo.local', port: 22 })
  })

  test('a password and a generated secret are never written', () => {
    const stored = mergeRemembered(
      CONFIGS,
      { host: 'h', passphrase: 'pw-123', apiKey: 'ett_secret' },
      {}
    )
    assert.deepStrictEqual(stored, { host: 'h' })
  })

  test('a password and a generated secret are never restored either', () => {
    // a manifest may have shipped the field as a plain string before it became
    // a password: the old value must not come back through it
    const stored = mergeRemembered([{ name: 'token', type: 'string' }], { token: 'old' }, {})
    assert.deepStrictEqual(stored, { token: 'old' })
    assert.deepStrictEqual(pickRemembered([{ name: 'token', type: 'password' }], stored), {})
    assert.deepStrictEqual(
      pickRemembered([{ name: 'token', type: 'string', showGenerator: true }], stored),
      {}
    )
  })

  test('keys the manifest no longer declares are ignored on the way out', () => {
    const stored = mergeRemembered(CONFIGS, { host: 'h', gone: 'stale' }, {})
    assert.deepStrictEqual(pickRemembered(CONFIGS, stored), { host: 'h' })
  })

  test('a write merges, so a widget’s own state under the same key survives', () => {
    // the same key is the config store a UI widget reads through getConfig
    const stored = mergeRemembered(CONFIGS, { host: 'new' }, { autoRun: true, host: 'old' })
    assert.deepStrictEqual(stored, { autoRun: true, host: 'new' })
  })

  test('nothing memorable in the values means no write at all', () => {
    assert.equal(mergeRemembered(CONFIGS, { passphrase: 'pw-123' }, {}), null)
    assert.equal(mergeRemembered(CONFIGS, null, {}), null)
  })

  test('an empty or malformed store is not a crash', () => {
    assert.deepStrictEqual(pickRemembered(CONFIGS, null), {})
    assert.deepStrictEqual(pickRemembered(CONFIGS, 'nope'), {})
    assert.deepStrictEqual(mergeRemembered(CONFIGS, { host: 'h' }, 'nope'), { host: 'h' })
  })

  test('the storage key is per widget, and stable', () => {
    assert.equal(widgetConfigKey('form-demo'), 'widget-config-form-demo')
  })
})
