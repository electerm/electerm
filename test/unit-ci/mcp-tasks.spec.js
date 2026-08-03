/**
 * Unit tests for the MCP Tasks extension (Phase 2 of electerm#4450, SEP-2663)
 *
 * 1. TaskManager (src/app/mcp/server/tasks.js) – pure unit tests
 * 2. HTTP-level protocol tests – real express server, mocked electron/renderer:
 *    capability advertisement, version negotiation, polymorphic task results,
 *    tasks/get + tasks/cancel dispatch, rejection of tasks/list etc.
 */

const { test, describe, before, after } = require('node:test')
const assert = require('assert/strict')

// ─────────────────────────────────────────────────────────────────────────────
// 1. TaskManager pure unit tests
// ─────────────────────────────────────────────────────────────────────────────

const { TaskManager } = require('../../src/app/mcp/server/tasks')

describe('TaskManager', () => {
  test('create returns a working task with wire fields', () => {
    const tm = new TaskManager({ ttl: 60000 })
    const task = tm.create({ toolName: 'execute_electerm_command', meta: { bgTaskId: 'bg-1' } })
    assert.ok(task.taskId.startsWith('task-'))
    assert.equal(task.status, 'working')
    assert.equal(task.ttl, 60000)
    assert.ok(task.pollIntervalMs > 0)
    assert.ok(task.createdAt)
    tm.destroy()
  })

  test('get throws on unknown task id', async () => {
    const tm = new TaskManager()
    await assert.rejects(() => tm.get('task-nope'), /Unknown task/)
    tm.destroy()
  })

  test('complete moves task to completed with result', async () => {
    const tm = new TaskManager()
    const task = tm.create({})
    tm.complete(task.taskId, { stdout: 'hi', exitCode: 0 })
    const wire = await tm.get(task.taskId)
    assert.equal(wire.status, 'completed')
    assert.deepEqual(wire.result, { stdout: 'hi', exitCode: 0 })
    assert.ok(!('error' in wire))
    tm.destroy()
  })

  test('fail moves task to failed with JSON-RPC error object', async () => {
    const tm = new TaskManager()
    const task = tm.create({})
    tm.fail(task.taskId, 'renderer exploded')
    const wire = await tm.get(task.taskId)
    assert.equal(wire.status, 'failed')
    assert.equal(wire.error.code, -32603)
    assert.equal(wire.error.message, 'renderer exploded')
    assert.ok(!('result' in wire))
    tm.destroy()
  })

  test('cancel runs onCancel hook then marks cancelled', async () => {
    const tm = new TaskManager()
    let hookCalled = null
    tm.onCancel = async (task) => { hookCalled = task.taskId }
    const task = tm.create({})
    const wire = await tm.cancel(task.taskId)
    assert.equal(hookCalled, task.taskId)
    assert.equal(wire.status, 'cancelled')
    tm.destroy()
  })

  test('cancelLocal marks cancelled without invoking the hook', async () => {
    const tm = new TaskManager()
    let hookCalled = false
    tm.onCancel = async () => { hookCalled = true }
    const task = tm.create({})
    tm.cancelLocal(task.taskId)
    const wire = await tm.get(task.taskId)
    assert.equal(hookCalled, false)
    assert.equal(wire.status, 'cancelled')
    tm.destroy()
  })

  test('terminal states are final — later transitions are no-ops', async () => {
    const tm = new TaskManager()
    const task = tm.create({})
    tm.cancelLocal(task.taskId)
    tm.complete(task.taskId, { stdout: 'late' })
    const wire = await tm.get(task.taskId)
    assert.equal(wire.status, 'cancelled')
    assert.ok(!('result' in wire))
    tm.destroy()
  })

  test('toWire never leaks server-private meta', async () => {
    const tm = new TaskManager()
    const task = tm.create({ meta: { bgTaskId: 'bg-secret', command: 'rm x' } })
    const wire = await tm.get(task.taskId)
    assert.ok(!('meta' in wire))
    assert.ok(!('toolName' in wire))
    tm.destroy()
  })

  test('onGet refresh hook runs only for working tasks', async () => {
    const tm = new TaskManager()
    let calls = 0
    tm.onGet = async (task) => {
      calls++
      tm.complete(task.taskId, { ok: true })
    }
    const task = tm.create({})
    const wire1 = await tm.get(task.taskId)
    assert.equal(calls, 1)
    assert.equal(wire1.status, 'completed') // refresh completed it inline
    const wire2 = await tm.get(task.taskId)
    assert.equal(calls, 1, 'hook must not run for terminal tasks')
    assert.equal(wire2.status, 'completed')
    tm.destroy()
  })

  test('sweep removes expired terminal tasks and calls onSweep', async () => {
    const tm = new TaskManager({ ttl: 5000 })
    const swept = []
    tm.onSweep = async (task) => { swept.push(task.taskId) }
    const old = tm.create({})
    tm.complete(old.taskId, {})
    // Force the endedAt into the past beyond the TTL
    tm.tasks.get(old.taskId).endedAt = new Date(Date.now() - 10000).toISOString()
    const fresh = tm.create({})
    tm.complete(fresh.taskId, {})
    const working = tm.create({})

    await tm.sweep()
    assert.deepEqual(swept, [old.taskId])
    await assert.rejects(() => tm.get(old.taskId), /Unknown task/)
    assert.equal((await tm.get(fresh.taskId)).status, 'completed')
    assert.equal((await tm.get(working.taskId)).status, 'working')
    tm.destroy()
  })

  test('maxTasks eviction prefers the oldest terminal task', async () => {
    const tm = new TaskManager({ maxTasks: 2 })
    const t1 = tm.create({})
    tm.complete(t1.taskId, {})
    const t2 = tm.create({})
    const t3 = tm.create({}) // exceeds capacity → evicts t1 (terminal)
    await assert.rejects(() => tm.get(t1.taskId), /Unknown task/)
    assert.ok(await tm.get(t2.taskId))
    assert.ok(await tm.get(t3.taskId))
    tm.destroy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP-level protocol tests
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

// Renderer behavior the tests can steer per tool call
const mockBehavior = {
  bgStatus: { status: 'completed', exitCode: 0, endTime: Date.now() },
  bgLog: { output: 'log line 1\nlog line 2' }
}

const mockWin = {
  webContents: {
    send (channel, payload) {
      if (channel !== 'mcp-request' || !capturedIpcHandler) return
      const { toolName } = payload.data || {}
      let result = { mocked: true }
      if (toolName === 'run_background_command') {
        result = {
          taskId: 'bg-mock-1',
          tabId: 'tab-1',
          logFile: '/tmp/electerm-bg-mock-1.log',
          pidFile: '/tmp/electerm-bg-mock-1.pid',
          exitFile: '/tmp/electerm-bg-mock-1.exit'
        }
      } else if (toolName === 'get_background_task_status') {
        result = { taskId: 'bg-mock-1', ...mockBehavior.bgStatus }
      } else if (toolName === 'get_background_task_log') {
        result = { taskId: 'bg-mock-1', ...mockBehavior.bgLog }
      } else if (toolName === 'cancel_background_task') {
        result = { taskId: 'bg-mock-1', status: 'cancelled' }
      } else if (toolName === 'cleanup_background_task') {
        result = { success: true }
      }
      setImmediate(() => {
        capturedIpcHandler({}, { requestId: payload.requestId, result })
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

const { widgetRun } = require('../../src/app/widgets/widget-mcp-server')

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

const TASKS_CAP = { 'io.modelcontextprotocol/tasks': {} }

async function initSession (port, { protocolVersion = '2025-11-25', withTasksCap = false } = {}) {
  const params = {
    protocolVersion,
    capabilities: withTasksCap ? { extensions: { ...TASKS_CAP } } : {},
    clientInfo: { name: 'test', version: '1' }
  }
  const res = await mcpPost(port, { jsonrpc: '2.0', id: 1, method: 'initialize', params })
  return { sid: res.headers['mcp-session-id'], init: res.data }
}

// tools/call with the SEP-2663 per-request client-capabilities _meta
async function callToolWithCaps (port, sid, toolName, args) {
  return mcpPost(port, {
    jsonrpc: '2.0',
    id: 99,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
      _meta: {
        'io.modelcontextprotocol/clientCapabilities': {
          extensions: { ...TASKS_CAP }
        }
      }
    }
  }, sid)
}

async function callTool (port, sid, toolName, args) {
  return mcpPost(port, {
    jsonrpc: '2.0',
    id: 98,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }, sid)
}

describe('MCP Tasks extension – protocol', () => {
  const PORT = 30862
  let instance = null

  before(async () => {
    instance = widgetRun({ host: '127.0.0.1', port: PORT })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('initialize advertises the tasks extension', async () => {
    const { init } = await initSession(PORT)
    assert.ok(init.result.capabilities.extensions, 'capabilities.extensions must exist')
    assert.ok('io.modelcontextprotocol/tasks' in init.result.capabilities.extensions)
  })

  test('initialize echoes supported protocol versions', async () => {
    const a = await initSession(PORT, { protocolVersion: '2024-11-05' })
    assert.equal(a.init.result.protocolVersion, '2024-11-05')
    const b = await initSession(PORT, { protocolVersion: '2025-11-25' })
    assert.equal(b.init.result.protocolVersion, '2025-11-25')
  })

  test('initialize falls back to newest supported version for unknown requests', async () => {
    const { init } = await initSession(PORT, { protocolVersion: '1999-01-01' })
    assert.equal(init.result.protocolVersion, '2025-11-25')
  })

  test('wait=false + client tasks capability returns resultType:"task"', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'running' }
    const res = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'npm run build',
      wait: false
    })
    const result = res.data.result
    assert.equal(result.resultType, 'task', `Expected task result, got: ${JSON.stringify(result)}`)
    assert.ok(result.task.taskId.startsWith('task-'))
    assert.equal(result.task.status, 'working')
    assert.ok(result.task.ttl > 0)
    assert.ok(result.task.pollIntervalMs > 0)
    assert.ok(!('meta' in result.task), 'task must not leak server-private meta')
  })

  test('wait=false via initialize-time capability also returns a task', async () => {
    const { sid } = await initSession(PORT, { withTasksCap: true })
    mockBehavior.bgStatus = { status: 'running' }
    const res = await callTool(PORT, sid, 'execute_electerm_command', {
      command: 'npm test',
      wait: false
    })
    assert.equal(res.data.result.resultType, 'task')
    assert.equal(res.data.result.task.status, 'working')
  })

  test('wait=false without client capability returns an error (legacy tools removed)', async () => {
    const { sid } = await initSession(PORT)
    const res = await callTool(PORT, sid, 'execute_electerm_command', {
      command: 'npm run build',
      wait: false
    })
    const result = res.data.result
    assert.ok(!result.resultType, 'must not be a task result without client opt-in')
    assert.equal(result.isError, true)
    const payload = JSON.parse(result.content[0].text)
    assert.ok(/MCP Tasks extension/.test(payload.error), `Expected tasks-required error, got: ${payload.error}`)
  })

  test('tasks/get polls to completion and returns the structured result', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'completed', exitCode: 0, endTime: Date.now() }
    mockBehavior.bgLog = { output: 'build ok\n42 tests passed' }

    const createRes = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'npm run build',
      wait: false
    })
    const taskId = createRes.data.result.task.taskId

    const getRes = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 50,
      method: 'tasks/get',
      params: { taskId }
    }, sid)
    const task = getRes.data.result
    assert.equal(task.taskId, taskId)
    assert.equal(task.status, 'completed')
    assert.equal(task.result.stdout, 'build ok\n42 tests passed')
    assert.equal(task.result.exitCode, 0)
    assert.equal(task.result.stderrMerged, true)
    assert.equal(task.result.mode, 'background')
    assert.equal(typeof task.result.durationMs, 'number')
  })

  test('tasks/get maps renderer cancelled state to cancelled', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'cancelled' }
    const createRes = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'sleep 100',
      wait: false
    })
    const taskId = createRes.data.result.task.taskId
    const getRes = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 51,
      method: 'tasks/get',
      params: { taskId }
    }, sid)
    assert.equal(getRes.data.result.status, 'cancelled')
  })

  test('tasks/get maps unknown renderer state to failed', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'unknown', message: 'PID file not found' }
    const createRes = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'sleep 100',
      wait: false
    })
    const taskId = createRes.data.result.task.taskId
    const getRes = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 52,
      method: 'tasks/get',
      params: { taskId }
    }, sid)
    const task = getRes.data.result
    assert.equal(task.status, 'failed')
    assert.equal(task.error.message, 'PID file not found')
  })

  test('tasks/get keeps working tasks working with a status message', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'running' }
    const createRes = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'sleep 100',
      wait: false
    })
    const taskId = createRes.data.result.task.taskId
    const getRes = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 53,
      method: 'tasks/get',
      params: { taskId }
    }, sid)
    const task = getRes.data.result
    assert.equal(task.status, 'working')
    assert.ok(/Running/.test(task.statusMessage), `Expected running message, got: ${task.statusMessage}`)
    assert.ok(!('result' in task), 'working task must not carry a result')
  })

  test('tasks/cancel marks the task cancelled and kills the remote process', async () => {
    const { sid } = await initSession(PORT)
    mockBehavior.bgStatus = { status: 'running' }
    const createRes = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'sleep 100',
      wait: false
    })
    const taskId = createRes.data.result.task.taskId
    const cancelRes = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 54,
      method: 'tasks/cancel',
      params: { taskId }
    }, sid)
    assert.equal(cancelRes.data.result.status, 'cancelled')
    // Terminal now — a second cancel is a no-op, still cancelled
    const again = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 55,
      method: 'tasks/cancel',
      params: { taskId }
    }, sid)
    assert.equal(again.data.result.status, 'cancelled')
  })

  test('tasks/get with unknown taskId returns -32602', async () => {
    const { sid } = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 56,
      method: 'tasks/get',
      params: { taskId: 'task-does-not-exist' }
    }, sid)
    assert.equal(res.data.error.code, -32602)
  })

  test('tasks/get without taskId returns -32602', async () => {
    const { sid } = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 57,
      method: 'tasks/get',
      params: {}
    }, sid)
    assert.equal(res.data.error.code, -32602)
  })

  test('tasks/list is not implemented (-32601)', async () => {
    const { sid } = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 58,
      method: 'tasks/list',
      params: {}
    }, sid)
    assert.equal(res.data.error.code, -32601)
  })

  test('tasks/update is not implemented (-32601)', async () => {
    const { sid } = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 59,
      method: 'tasks/update',
      params: { taskId: 'task-x' }
    }, sid)
    assert.equal(res.data.error.code, -32601)
  })

  test('sync wait=true path is unaffected by tasks capability', async () => {
    const { sid } = await initSession(PORT)
    const res = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'echo hello'
    })
    const result = res.data.result
    assert.ok(!result.resultType, 'sync path must never return a task')
    assert.ok(Array.isArray(result.content))
  })
})

describe('MCP Tasks extension – disabled via config', () => {
  const PORT = 30863
  let instance = null

  before(async () => {
    instance = widgetRun({ host: '127.0.0.1', port: PORT, enableTasks: false })
    await instance.start()
  })

  after(async () => {
    if (instance) await instance.stop()
  })

  test('initialize does not advertise extensions when disabled', async () => {
    const { init } = await initSession(PORT)
    assert.ok(!init.result.capabilities.extensions, 'extensions must be absent when enableTasks=false')
  })

  test('tasks/get returns -32601 when disabled', async () => {
    const { sid } = await initSession(PORT)
    const res = await mcpPost(PORT, {
      jsonrpc: '2.0',
      id: 60,
      method: 'tasks/get',
      params: { taskId: 'task-x' }
    }, sid)
    assert.equal(res.data.error.code, -32601)
  })

  test('wait=false with client caps errors when the extension is disabled', async () => {
    const { sid } = await initSession(PORT, { withTasksCap: true })
    const res = await callToolWithCaps(PORT, sid, 'execute_electerm_command', {
      command: 'npm run build',
      wait: false
    })
    const result = res.data.result
    assert.ok(!result.resultType, 'no task result when the extension is disabled')
    assert.equal(result.isError, true)
  })
})
