/**
 * Unit tests for the MCP get_electerm_command_rules tool.
 *
 * HTTP-level only — a real express server with a mocked electron + renderer
 * bridge, same pattern as mcp-keepalive.spec.js. The point under test is that
 * the reported rules are the rules enforcement actually uses (both sides share
 * getCommandRules()), so the tests compare the reported lists against what
 * send_electerm_terminal_command rejects.
 */

const { test, describe, before, after } = require('node:test')
const assert = require('assert/strict')
const axios = require('axios')
const Module = require('module')

let capturedIpcHandler = null
const mockIpcMain = {
  on (channel, fn) {
    if (channel === 'mcp-response') capturedIpcHandler = fn
  },
  removeListener (channel, fn) {
    if (channel === 'mcp-response') capturedIpcHandler = null
  }
}

// Everything the widget sends over the mcp-request channel. A rejected command
// must never show up here — that is what "filtered before it leaves electerm"
// means, asserted rather than assumed.
const rendererCalls = []
const mockWin = {
  webContents: {
    send (channel, payload) {
      if (channel !== 'mcp-request') return
      rendererCalls.push(payload)
      if (!capturedIpcHandler) return
      setImmediate(() => {
        capturedIpcHandler({}, {
          requestId: payload.requestId,
          result: { ok: true }
        })
      })
    }
  }
}

const mockGlobState = {
  get (key) { return key === 'win' ? mockWin : null },
  set () {}
}

const originalLoad = Module._load.bind(Module)
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { ipcMain: mockIpcMain }
  if (request.includes('glob-state')) return mockGlobState
  return originalLoad(request, parent, isMain)
}

const { widgetRun } = require('../../../src/app/widgets/widget-mcp-server')

Module._load = originalLoad

function parseSseBody (body) {
  if (body && typeof body === 'object') return body
  if (typeof body !== 'string') return null
  const dataLine = body.split('\n').find(l => l.startsWith('data: '))
  if (dataLine) return JSON.parse(dataLine.slice(6))
  try {
    return JSON.parse(body)
  } catch (e) {
    return null
  }
}

const TEST_API_KEY = 'test-api-key'

async function mcpPost (port, body, sid) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${TEST_API_KEY}`
  }
  if (sid) headers['mcp-session-id'] = sid
  // proxy:false — never route localhost through an env proxy.
  const res = await axios.post(`http://127.0.0.1:${port}/mcp`, body, { headers, proxy: false })
  return { status: res.status, headers: res.headers, data: parseSseBody(res.data) }
}

async function initSession (port) {
  const res = await mcpPost(port, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } }
  })
  return res.headers['mcp-session-id']
}

async function callTool (port, sid, toolName, args) {
  return mcpPost(port, {
    jsonrpc: '2.0',
    id: 99,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }, sid)
}

async function listTools (port) {
  const sid = await initSession(port)
  const res = await mcpPost(port, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sid)
  return res.data.result.tools
}

async function readRules (port) {
  const sid = await initSession(port)
  const res = await callTool(port, sid, 'get_electerm_command_rules', {})
  return JSON.parse(res.data.result.content[0].text)
}

describe('get_electerm_command_rules – blacklist mode', () => {
  const PORT = 30864
  // Deliberately messy: a blank line and surrounding whitespace must be
  // normalised the same way the enforcement path normalises them.
  const RAW_BLACKLIST = '^forbidden\n\n   ^curl .* pastebin   '
  let instance = null

  before(async () => {
    instance = widgetRun({
      host: '127.0.0.1',
      port: PORT,
      apiKey: TEST_API_KEY,
      commandBlacklist: RAW_BLACKLIST,
      commandWhitelist: ''
    })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('is registered as a zero-argument tool', async () => {
    const tools = await listTools(PORT)
    const tool = tools.find(t => t.name === 'get_electerm_command_rules')
    assert.ok(tool, 'get_electerm_command_rules must be registered')
    assert.deepEqual(tool.inputSchema.properties, {})
    assert.deepEqual(tool.inputSchema.required, undefined)
    assert.match(tool.description, /blacklist/i)
    assert.match(tool.description, /whitelist/i)
    assert.match(tool.description, /regular expression/i)
  })

  test('reports blacklist mode, parsed user patterns and the built-in list', async () => {
    const rules = await readRules(PORT)
    assert.equal(rules.mode, 'blacklist')
    assert.deepEqual(rules.commandBlacklist, ['^forbidden', '^curl .* pastebin'])
    assert.deepEqual(rules.commandWhitelist, [])
    assert.equal(rules.builtinBlacklist.length, 12, 'all built-in rules must be exposed')
    assert.ok(
      rules.builtinBlacklist.some(p => p === '\\bmkfs\\b'),
      'built-in patterns are regex sources, not display strings'
    )
  })

  test('the reported blacklist is the one enforcement applies', async () => {
    const sid = await initSession(PORT)
    rendererCalls.length = 0
    const res = await callTool(PORT, sid, 'send_electerm_terminal_command', {
      command: 'forbidden-exec touch /tmp/x'
    })
    assert.equal(res.data.result.isError, true)
    assert.match(
      JSON.parse(res.data.result.content[0].text).error,
      /blacklist pattern: \^forbidden/
    )
    assert.equal(rendererCalls.length, 0, 'a rejected command must not reach the renderer')
  })

  test('built-in rules still apply', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'send_electerm_terminal_command', {
      command: 'mkfs.ext4 /dev/sdb1'
    })
    assert.equal(res.data.result.isError, true)
    assert.match(
      JSON.parse(res.data.result.content[0].text).error,
      /built-in safety rule/
    )
  })

  test('every rejection names the rules tool', async () => {
    const sid = await initSession(PORT)
    for (const command of ['mkfs.ext4 /dev/sdb1', 'forbidden-exec touch /tmp/x']) {
      const res = await callTool(PORT, sid, 'send_electerm_terminal_command', { command })
      assert.equal(res.data.result.isError, true)
      assert.match(
        JSON.parse(res.data.result.content[0].text).error,
        /get_electerm_command_rules/,
        'a rejection must tell the agent where the rules are'
      )
    }
  })
})

describe('get_electerm_command_rules – whitelist mode', () => {
  const PORT = 30865
  let instance = null

  before(async () => {
    instance = widgetRun({
      host: '127.0.0.1',
      port: PORT,
      apiKey: TEST_API_KEY,
      commandWhitelist: '^ls\n ^cat '
    })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('a non-empty whitelist switches the reported mode', async () => {
    const rules = await readRules(PORT)
    assert.equal(rules.mode, 'whitelist')
    assert.deepEqual(rules.commandWhitelist, ['^ls', '^cat'])
    assert.deepEqual(rules.commandBlacklist, [])
  })

  test('a command matching no whitelist entry is rejected', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'execute_electerm_command', { command: 'reboot' })
    assert.equal(res.data.result.isError, true)
    const { error } = JSON.parse(res.data.result.content[0].text)
    assert.match(error, /not in whitelist/)
    // whitelist mode is where a bare rejection teaches an agent the least —
    // it has to be told the rules are readable.
    assert.match(error, /get_electerm_command_rules/)
  })
})
