const { test } = require('node:test')
const assert = require('node:assert/strict')
const preferences = import('../../client/components/ai/agent-permission-preferences.js')

async function setup (t) {
  const prefs = await preferences
  const storage = {
    getItem (key) { return this[key] ?? null },
    setItem (key, value) { this[key] = value },
    removeItem (key) { delete this[key] }
  }
  const win = Object.assign(new EventTarget(), { localStorage: storage, et: { isWebApp: true } })
  global.window = win
  t.after(() => { delete global.window })
  prefs.resetAgentPermissions()
  return { prefs, storage, win }
}

test('an inaccessible localStorage defaults to manual and lets settings reset finish', async t => {
  const { prefs, win } = await setup(t)
  Object.defineProperty(win, 'localStorage', { get () { throw new Error('Storage disabled') } })
  assert.equal(prefs.readAgentApprovalMode(), 'manual')
  assert.deepEqual(prefs.readAgentCommandAllowlist(), [])
  prefs.setAgentApprovalMode('auto')
  prefs.rememberAgentCommand('pwd')
  prefs.resetAgentPermissions()
  assert.equal(prefs.readAgentApprovalMode(), 'manual')
  assert.deepEqual(prefs.readAgentCommandAllowlist(), [])
})

test('reset clears the allowlist even if removing the mode fails', async t => {
  const { prefs, storage } = await setup(t)
  prefs.setAgentApprovalMode('auto')
  prefs.rememberAgentCommand('pwd')
  storage.removeItem = function (key) {
    if (key === 'agentApprovalMode') throw new Error('Read only')
    delete this[key]
  }
  prefs.resetAgentPermissions()
  assert.equal(storage.agentCommandAllowlist, undefined)
  assert.equal(storage.agentApprovalMode, 'auto')
  assert.equal(prefs.readAgentApprovalMode(), 'manual')
})

test('quota recovery preserves recent commands and unrelated sessions', async t => {
  const { prefs, storage } = await setup(t)
  storage['term:sess:keep'] = 'session'
  storage.setItem = function (key, value) {
    if (value.length > 17) throw new DOMException('Full', 'QuotaExceededError')
    this[key] = value
  }
  prefs.setAgentCommandAllowlist(['pwd', 'ls', 'whoami', 'date'])
  assert.deepEqual(prefs.readAgentCommandAllowlist(), ['whoami', 'date'])
  prefs.rememberAgentCommand('too large to remember')
  assert.deepEqual(prefs.readAgentCommandAllowlist(), ['whoami', 'date'])
  assert.equal(storage['term:sess:keep'], 'session')
})

test('a failed explicit edit revokes stale grants even in read-only storage', async t => {
  const { prefs, storage } = await setup(t)
  prefs.rememberAgentCommand('old command')
  storage.setItem = storage.removeItem = () => { throw new Error('Read only') }
  assert.equal(prefs.setAgentCommandAllowlist(['new command']), false)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), [])
})

test('desktop writes keep the existing encrypted storage format', async t => {
  const { prefs, storage, win } = await setup(t)
  win.et.isWebApp = false
  win.pre = { runSync: () => 'test-storage-key' }
  prefs.rememberAgentCommand('git status')
  assert.match(storage.agentCommandAllowlist, /^enc1:/)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), ['git status'])
})
