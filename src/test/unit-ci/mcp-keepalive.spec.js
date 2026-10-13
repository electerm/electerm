/**
 * Unit tests for the MCP set_electerm_terminal_keepalive tool.
 *
 * HTTP-level wiring only — a real express server with a mocked electron +
 * renderer bridge, same pattern as mcp-exec.spec.js. The two halves of the
 * mechanism itself are covered elsewhere:
 *   - the client actually sends the keepalive frame when idle ->
 *     attach-addon-custom.spec.js ("session keepalive")
 *   - end-to-end against a live app -> src/test/integration/mcp.spec.js
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

// Echo the request back so passthrough of `enabled` is actually asserted
// rather than assumed.
const mockWin = {
  webContents: {
    send (channel, payload) {
      if (channel !== 'mcp-request' || !capturedIpcHandler) return
      const { enabled, tabId } = payload.data.args
      setImmediate(() => {
        capturedIpcHandler({}, {
          requestId: payload.requestId,
          result: { success: true, tabId, keepalive: enabled }
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

async function mcpPost (port, body, sid) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  }
  if (sid) headers['mcp-session-id'] = sid
  // proxy:false — never route localhost through an env proxy; reused
  // proxy keep-alive sockets get reset and break the tests.
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

// Capture the next mcp-request payload the widget sends to the renderer.
async function captureRendererCall (fn) {
  let captured = null
  const origSend = mockWin.webContents.send.bind(mockWin.webContents)
  mockWin.webContents.send = (channel, payload) => {
    if (channel === 'mcp-request') captured = payload
    origSend(channel, payload)
  }
  try {
    await fn()
  } finally {
    mockWin.webContents.send = origSend
  }
  return captured
}

describe('set_electerm_terminal_keepalive – tool surface & wiring', () => {
  const PORT = 30854
  let instance = null

  before(async () => {
    instance = widgetRun({ host: '127.0.0.1', port: PORT })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('tools/list registers the tool with a required boolean `enabled`', async () => {
    const tools = await listTools(PORT)
    const tool = tools.find(t => t.name === 'set_electerm_terminal_keepalive')
    assert.ok(tool, 'set_electerm_terminal_keepalive must be registered')

    const props = tool.inputSchema.properties
    assert.equal(props.enabled.type, 'boolean')
    assert.equal(props.tabId.type, 'string')
    assert.deepEqual(tool.inputSchema.required, ['enabled'],
      'enabled must be required, tabId optional')

    assert.match(tool.description, /keepalive/i)
    assert.match(tool.description, /sftp/i,
      'description should point at the long-transfer use case')
  })

  test('enabled=true and tabId reach the renderer bridge', async () => {
    const sid = await initSession(PORT)
    let res = null
    const captured = await captureRendererCall(async () => {
      res = await callTool(PORT, sid, 'set_electerm_terminal_keepalive', {
        enabled: true,
        tabId: 'tab-42'
      })
    })

    assert.ok(captured, 'request must reach the renderer bridge')
    assert.equal(captured.data.toolName, 'set_terminal_keepalive')
    assert.equal(captured.data.args.enabled, true)
    assert.equal(captured.data.args.tabId, 'tab-42')

    const payload = JSON.parse(res.data.result.content[0].text)
    assert.equal(payload.success, true)
    assert.equal(payload.keepalive, true)
  })

  test('enabled=false is forwarded unchanged (not coerced to a toggle)', async () => {
    const sid = await initSession(PORT)
    let res = null
    const captured = await captureRendererCall(async () => {
      res = await callTool(PORT, sid, 'set_electerm_terminal_keepalive', { enabled: false })
    })

    assert.equal(captured.data.args.enabled, false)
    assert.equal(captured.data.args.tabId, undefined,
      'omitted tabId must stay omitted so the renderer resolves the active tab')

    const payload = JSON.parse(res.data.result.content[0].text)
    assert.equal(payload.keepalive, false)
  })

  test('get_electerm_terminal_status description advertises keepalive', async () => {
    const tools = await listTools(PORT)
    const tool = tools.find(t => t.name === 'get_electerm_terminal_status')
    assert.ok(tool.description.includes('keepalive'),
      'status tool description should mention the keepalive field')
  })
})
