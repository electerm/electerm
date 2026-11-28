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
  assert.equal(prefs.setAgentApprovalMode('auto'), false)
  assert.equal(prefs.rememberAgentCommand('pwd'), false)
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

test('a rejected auto grant and a failed manual revocation both report failure and stay manual', async t => {
  const { prefs, storage } = await setup(t)
  assert.equal(prefs.setAgentApprovalMode('auto'), true)
  storage.removeItem = () => { throw new Error('Removal denied') }
  assert.equal(prefs.setAgentApprovalMode('manual'), false)
  assert.equal(prefs.readAgentApprovalMode(), 'manual')
  storage.setItem = () => { throw new Error('Write denied') }
  assert.equal(prefs.setAgentApprovalMode('auto'), false)
  assert.equal(prefs.readAgentApprovalMode(), 'manual')
})

test('quota failure preserves all existing grants and unrelated sessions for additions', async t => {
  const { prefs, storage } = await setup(t)
  storage['term:sess:keep'] = 'session'
  const previous = ['pwd', 'ls']
  assert.equal(prefs.setAgentCommandAllowlist(previous), true)
  storage.setItem = function (key, value) {
    if (value.length > JSON.stringify(previous).length) throw new DOMException('Full', 'QuotaExceededError')
    this[key] = value
  }
  assert.equal(prefs.setAgentCommandAllowlist([...previous, 'whoami', 'date']), false)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), previous)
  assert.equal(prefs.rememberAgentCommand('date'), false)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), previous)
  assert.equal(storage['term:sess:keep'], 'session')
})

test('a failed replacement persists just the old grants the user kept', async t => {
  const { prefs, storage } = await setup(t)
  assert.equal(prefs.setAgentCommandAllowlist(['keep', 'revoke']), true)
  storage.setItem = function (key, value) {
    if (value.length > 15) throw new DOMException('Full', 'QuotaExceededError')
    this[key] = value
  }
  assert.equal(prefs.setAgentCommandAllowlist(['keep', 'a new command that does not fit']), false)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), ['keep'])
  assert.equal(prefs.setAgentCommandAllowlist([]), true)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), [])
})

test('remembering never overwrites a list that cannot be read', async t => {
  const { prefs, storage } = await setup(t)
  assert.equal(prefs.rememberAgentCommand('previous'), true)
  const serialized = storage.agentCommandAllowlist
  storage.getItem = () => { throw new Error('Read denied') }
  assert.equal(prefs.rememberAgentCommand('new'), false)
  assert.equal(storage.agentCommandAllowlist, serialized)
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
  assert.equal(prefs.rememberAgentCommand('git status'), true)
  assert.match(storage.agentCommandAllowlist, /^enc1:/)
  assert.deepEqual(prefs.readAgentCommandAllowlist(), ['git status'])
})
