const { test } = require('node:test')
const assert = require('node:assert/strict')
const permissions = import('../../client/components/ai/agent-permissions.js')

test('missing or unrecognized approval settings require manual approval', async () => {
  const { normalizeAgentApprovalMode, normalizeAgentCommandAllowlist } = await permissions
  for (const mode of [undefined, {}, true, 'automatic']) {
    assert.equal(normalizeAgentApprovalMode(mode), 'manual')
  }
  assert.equal(normalizeAgentApprovalMode('auto'), 'auto')
  assert.deepEqual(normalizeAgentCommandAllowlist('pwd'), [])
})

test('remembered commands preserve literal spacing and round-trip as visible, individual lines', async () => {
  const { normalizeAgentCommandAllowlist } = await permissions
  const entries = ['pwd', ' pwd', 'pwd ', 'pwd', 'ls *', ' ', 42, 'a\nb', 'a\rb', 'a\tb', 'a\u202eb', 'a\u2028b']
  assert.deepEqual(normalizeAgentCommandAllowlist(entries), ['pwd', ' pwd', 'pwd ', 'ls *'])
})
