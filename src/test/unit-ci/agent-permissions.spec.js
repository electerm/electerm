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

test('the settings editor accepts mixed CRLF and LF without trimming commands', async () => {
  const { parseAgentCommandLines } = await permissions
  assert.deepEqual(parseAgentCommandLines(' pwd \r\nls  \n\r\nbad\rcommand\r\ngit status\r'), [
    ' pwd ', 'ls  ', 'git status'
  ])
})

test('the allowlist keeps the last 200 distinct valid entries', async () => {
  const { normalizeAgentCommandAllowlist } = await permissions
  const commands = Array.from({ length: 205 }, (_, i) => 'echo ' + i)
  const stored = [...commands, '', commands[204], 42]
  assert.deepEqual(normalizeAgentCommandAllowlist(stored), commands.slice(5))
})
