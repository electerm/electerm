/**
 * Unit tests for execute_electerm_command (Phase 1 of electerm#4450)
 *
 * 1. session-common.js execCommand() – pure unit tests with a mock ssh2 client
 * 2. HTTP-level tool wiring – real express server with mocked electron/renderer,
 *    same pattern as mcp-widget.spec.js
 */

const { test, describe, before, after } = require('node:test')
const assert = require('assert/strict')
const { EventEmitter } = require('events')

// ─────────────────────────────────────────────────────────────────────────────
// 1. execCommand (session-common.js) with mock ssh2 client
// ─────────────────────────────────────────────────────────────────────────────

const { commonExtends } = require('../../src/app/server/session-common')

function makeSession (client) {
  class FakeSession {}
  FakeSession.prototype.conn = client
  FakeSession.prototype.initOptions = {}
  commonExtends(FakeSession)
  return new FakeSession()
}

// Build a fake ssh2 exec stream. `script(stream)` schedules the emissions.
function makeClient (script) {
  return {
    exec (cmd, opts, cb) {
      const stream = new EventEmitter()
      stream.stderr = new EventEmitter()
      stream.closed = false
      stream.close = () => { stream.closed = true }
      setImmediate(() => script(stream))
      cb(null, stream)
    }
  }
}

describe('execCommand – session layer', () => {
  test('captures stdout, stderr and exit code separately', async () => {
    const client = makeClient((stream) => {
      stream.emit('data', Buffer.from('hello\n'))
      stream.stderr.emit('data', Buffer.from('warn\n'))
      stream.emit('data', Buffer.from('world\n'))
      stream.emit('exit', 0)
      stream.emit('close')
    })
    const r = await makeSession(client).execCommand('ls')
    assert.equal(r.stdout, 'hello\nworld\n')
    assert.equal(r.stderr, 'warn\n')
    assert.equal(r.exitCode, 0)
    assert.equal(r.timedOut, false)
  })

  test('resolves non-zero exit codes without rejecting', async () => {
    const client = makeClient((stream) => {
      stream.stderr.emit('data', Buffer.from('boom'))
      stream.emit('exit', 3)
      stream.emit('close')
    })
    const r = await makeSession(client).execCommand('false')
    assert.equal(r.exitCode, 3)
    assert.equal(r.stderr, 'boom')
    assert.equal(r.timedOut, false)
  })

  test('resolves exitCode null when server sends no exit status', async () => {
    const client = makeClient((stream) => {
      stream.emit('data', Buffer.from('x'))
      stream.emit('close')
    })
    const r = await makeSession(client).execCommand('ls')
    assert.equal(r.exitCode, null)
    assert.equal(r.stdout, 'x')
  })

  test('resolves empty result when no stream is returned', async () => {
    const client = { exec (cmd, opts, cb) { cb(null, null) } }
    const r = await makeSession(client).execCommand('ls')
    assert.deepEqual(r, { stdout: '', stderr: '', exitCode: null, timedOut: false })
  })

  test('rejects on exec error', async () => {
    const client = { exec (cmd, opts, cb) { cb(new Error('channel open failure')) } }
    await assert.rejects(
      () => makeSession(client).execCommand('ls'),
      /channel open failure/
    )
  })

  test('rejects when client does not support exec', async () => {
    await assert.rejects(
      () => makeSession({}).execCommand('ls'),
      /not supported/i
    )
  })

  test('timeout resolves partial output with timedOut=true and closes stream', async () => {
    let capturedStream = null
    const client = makeClient((stream) => {
      capturedStream = stream
      stream.emit('data', Buffer.from('partial\n'))
      // never emits exit/close — simulates a hanging command
    })
    const r = await makeSession(client).execCommand('sleep 999', { timeoutMs: 50 })
    assert.equal(r.timedOut, true)
    assert.equal(r.stdout, 'partial\n')
    assert.equal(r.exitCode, null)
    assert.equal(capturedStream.closed, true, 'stream.close() must be called on timeout')
  })

  test('no timeout by default (timeoutMs=0)', async () => {
    const client = makeClient((stream) => {
      setTimeout(() => {
        stream.emit('data', Buffer.from('done'))
        stream.emit('exit', 0)
        stream.emit('close')
      }, 30)
    })
    const r = await makeSession(client).execCommand('ls')
    assert.equal(r.timedOut, false)
    assert.equal(r.stdout, 'done')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP-level wiring (mock electron + renderer, real express server)
// ─────────────────────────────────────────────────────────────────────────────

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

const mockWin = {
  webContents: {
    send (channel, payload) {
      if (channel !== 'mcp-request' || !capturedIpcHandler) return
      setImmediate(() => {
        capturedIpcHandler({}, { requestId: payload.requestId, result: { mocked: true } })
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

const {
  widgetInfo,
  widgetRun
} = require('../../src/app/widgets/widget-mcp-server')

Module._load = originalLoad

function parseSseBody (body) {
  const dataLine = (typeof body === 'string' ? body : JSON.stringify(body))
    .split('\n').find(l => l.startsWith('data: '))
  if (!dataLine) return null
  return JSON.parse(dataLine.slice(6))
}

async function mcpPost (port, body, sid) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  }
  if (sid) headers['mcp-session-id'] = sid
  // proxy:false — never route localhost through a proxy from env (HTTP_PROXY
  // etc.); reused proxy keep-alive sockets get reset and break the tests.
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

describe('execute_electerm_command – widget config & wiring', () => {
  const PORT = 30852
  let instance = null

  before(async () => {
    instance = widgetRun({
      host: '127.0.0.1',
      port: PORT,
      commandBlacklist: '^forbidden-exec'
    })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('widgetInfo has execTimeoutMs and execMaxOutputBytes configs', () => {
    const timeoutCfg = widgetInfo.configs.find(c => c.name === 'execTimeoutMs')
    assert.ok(timeoutCfg, 'execTimeoutMs config must exist')
    assert.equal(timeoutCfg.type, 'number')
    assert.equal(timeoutCfg.default, 120000)

    const maxCfg = widgetInfo.configs.find(c => c.name === 'execMaxOutputBytes')
    assert.ok(maxCfg, 'execMaxOutputBytes config must exist')
    assert.equal(maxCfg.type, 'number')
    assert.equal(maxCfg.default, 204800)
  })

  test('tools/list includes execute_electerm_command', async () => {
    const sid = await initSession(PORT)
    const res = await mcpPost(PORT, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sid)
    assert.equal(res.status, 200)
    const names = res.data.result.tools.map(t => t.name)
    assert.ok(names.includes('execute_electerm_command'), 'Missing execute_electerm_command')
  })

  test('blacklisted command is rejected before reaching renderer', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'execute_electerm_command', { command: 'forbidden-exec --now' })
    const text = res.data.result.content[0].text
    assert.ok(text.includes('blacklist'), `Expected "blacklist" in error text, got: ${text}`)
    assert.equal(res.data.result.isError, true)
  })

  test('built-in blacklist rejects rm -rf /', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'execute_electerm_command', { command: 'rm -rf /' })
    const text = res.data.result.content[0].text
    assert.ok(
      text.includes('blocked') || text.includes('safety') || text.includes('built-in'),
      `Expected safety rejection, got: ${text}`
    )
    assert.equal(res.data.result.isError, true)
  })

  test('safe command reaches renderer mock', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'execute_electerm_command', { command: 'echo hello' })
    const text = res.data.result.content[0].text
    assert.ok(text.includes('mocked'), `Expected mocked renderer response, got: ${text}`)
  })

  test('passes timeoutMs and maxOutputBytes through to the renderer', async () => {
    // Replace the mock handler temporarily to capture the request payload
    const sid = await initSession(PORT)
    let captured = null
    const prevHandler = capturedIpcHandler
    capturedIpcHandler = (event, response) => prevHandler(event, response)
    // Spy on the mock win instead: wrap webContents.send
    const origSend = mockWin.webContents.send.bind(mockWin.webContents)
    mockWin.webContents.send = (channel, payload) => {
      if (channel === 'mcp-request') captured = payload
      origSend(channel, payload)
    }
    try {
      await callTool(PORT, sid, 'execute_electerm_command', { command: 'echo hi', timeoutMs: 5000 })
    } finally {
      mockWin.webContents.send = origSend
    }
    assert.ok(captured, 'request must reach the renderer bridge')
    assert.equal(captured.data.toolName, 'execute_command')
    assert.equal(captured.data.args.command, 'echo hi')
    assert.equal(captured.data.args.timeoutMs, 5000)
    assert.equal(captured.data.args.maxOutputBytes, 204800)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Phase 3: mode param, legacy background tools removed
// ─────────────────────────────────────────────────────────────────────────────

describe('execute_electerm_command – mode param & legacy tool removal', () => {
  const PORT = 30853
  let instance = null

  before(async () => {
    instance = widgetRun({ host: '127.0.0.1', port: PORT })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  async function listTools () {
    const sid = await initSession(PORT)
    const res = await mcpPost(PORT, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sid)
    return res.data.result.tools
  }

  test('schema exposes mode (enum exec|pty) and wait (boolean)', async () => {
    const tools = await listTools()
    const tool = tools.find(t => t.name === 'execute_electerm_command')
    assert.ok(tool, 'execute_electerm_command must be registered')
    const props = tool.inputSchema.properties
    assert.deepEqual(props.mode.enum, ['exec', 'pty'])
    assert.equal(props.mode.type, 'string')
    assert.equal(props.wait.type, 'boolean')
    assert.equal(props.timeoutMs.type, 'number')
  })

  test('mode is passed through to the renderer', async () => {
    const sid = await initSession(PORT)
    let captured = null
    const origSend = mockWin.webContents.send.bind(mockWin.webContents)
    mockWin.webContents.send = (channel, payload) => {
      if (channel === 'mcp-request') captured = payload
      origSend(channel, payload)
    }
    try {
      await callTool(PORT, sid, 'execute_electerm_command', { command: 'ls --color', mode: 'pty' })
    } finally {
      mockWin.webContents.send = origSend
    }
    assert.ok(captured, 'request must reach the renderer bridge')
    assert.equal(captured.data.args.mode, 'pty')
  })

  test('legacy background tools are removed from tools/list', async () => {
    const tools = await listTools()
    const names = tools.map(t => t.name)
    for (const name of [
      'run_electerm_background_command',
      'get_electerm_background_task_status',
      'get_electerm_background_task_log',
      'cancel_electerm_background_task'
    ]) {
      assert.ok(!names.includes(name), `${name} must be removed (superseded by execute_electerm_command + tasks)`)
    }
  })

  test('calling a removed legacy tool returns tool-not-found', async () => {
    const sid = await initSession(PORT)
    const res = await callTool(PORT, sid, 'run_electerm_background_command', { command: 'echo ok' })
    assert.ok(res.data.error, 'Expected JSON-RPC error for removed tool')
    assert.equal(res.data.error.code, -32601)
  })

  test('send_electerm_terminal_command description points to execute_electerm_command', async () => {
    const tools = await listTools()
    const tool = tools.find(t => t.name === 'send_electerm_terminal_command')
    assert.ok(tool.description.includes('execute_electerm_command'),
      'send tool description should guide agents to the unified tool')
  })

  test('wait=false without client tasks capability returns an error', async () => {
    const sid = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 77,
      method: 'tools/call',
      params: {
        name: 'execute_electerm_command',
        arguments: { command: 'npm run build', wait: false }
      }
    }, sid)
    const result = res.data.result
    assert.ok(!result.resultType, 'no task handle without client opt-in')
    assert.equal(result.isError, true)
    const payload = JSON.parse(result.content[0].text)
    assert.ok(/MCP Tasks extension/.test(payload.error), `Expected tasks-required error, got: ${payload.error}`)
  })
})
