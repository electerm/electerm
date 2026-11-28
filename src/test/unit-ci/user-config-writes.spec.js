const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

test('a concurrent legacy settings save preserves the migrated AI profile selection', async t => {
  const legacy = { apiKeyAI: 'old-key', modelAI: 'old-model' }
  let stored = { ...legacy }
  const dependencies = {
    './db': {
      dbAction: async (name, op, query, doc) => { stored = { ...doc } }
    },
    './get-config': { getDbConfig: async () => ({ ...stored }) },
    '../common/log': {}
  }
  const load = Module._load
  const mock = t.mock.method(Module, '_load', function (name, ...args) {
    return dependencies[name] || load.call(this, name, ...args)
  })
  const { saveUserConfig } = require('../../app/lib/user-config-controller')
  mock.mock.restore()

  await Promise.all([
    saveUserConfig({ activeAIConfigId: 'profile', fontSize: 18 }),
    saveUserConfig({ ...legacy, scrollback: 500 })
  ])

  assert.deepEqual(stored, {
    _id: 'userConfig', activeAIConfigId: 'profile', fontSize: 18, scrollback: 500
  })
})
