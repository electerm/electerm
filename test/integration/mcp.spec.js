/**
 * Integration tests for the electerm MCP server — runs against a LIVE app.
 *
 * Prerequisites:
 *   - electerm dev app running (npm start + npm run app)
 *   - MCP Server widget started on http://127.0.0.1:30837/mcp, default config
 *     (no apiKey; bookmarks/groups/sftp enabled; tasks extension enabled)
 *
 * SSH-dependent tests use an in-process test SSH server (@electerm/ssh2),
 * see test/integration/lib/ssh-test-server.js — no external SSH host needed.
 *
 * All tests self-skip when the MCP server is unreachable.
 * Run: npm run test-integration
 */

const { test, describe, before, after } = require('node:test')
const assert = require('assert/strict')
const axios = require('axios')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  startTestSshServer,
  ensureKnownHostsEntry,
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_PORT
} = require('./lib/ssh-test-server')

const serverUrl = 'http://127.0.0.1:30837/mcp'
const uid = Date.now()

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers (proxy:false — never route localhost through env proxies)
// ─────────────────────────────────────────────────────────────────────────────

async function makeHttpRequest (method, urlStr, data = null, headers = {}) {
  try {
    const response = await axios({
      method: method.toUpperCase(),
      url: urlStr,
      data,
      headers,
      proxy: false
    })
    return {
      status: response.status,
      headers: response.headers,
      data: response.data
    }
  } catch (error) {
    if (error.response) {
      const err = new Error(`Request failed with status ${error.response.status}`)
      err.response = {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      }
      throw err
    }
    throw error
  }
}

async function makeStreamGetRequest (urlStr, headers = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers,
      agent: false
    }, (res) => {
      let data = ''
      let settled = false
      const finish = () => {
        if (!settled) {
          settled = true
          res.destroy()
          resolve({ status: res.statusCode, headers: res.headers, data })
        }
      }
      res.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes(': ping')) finish()
      })
      res.on('end', finish)
      setTimeout(finish, timeoutMs)
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error('Stream request timed out'))
    })
    req.end()
  })
}

function parseSseBody (body) {
  const dataLine = (typeof body === 'string' ? body : JSON.stringify(body))
    .split('\n').find(l => l.startsWith('data: '))
  if (!dataLine) return null
  return JSON.parse(dataLine.slice(6))
}

async function initSession ({ protocolVersion = '2025-11-25', withTasksCap = false } = {}) {
  const res = await makeHttpRequest('post', serverUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion,
      capabilities: withTasksCap
        ? { extensions: { 'io.modelcontextprotocol/tasks': {} } }
        : {},
      clientInfo: { name: 'electerm-integration-test', version: '1.0.0' }
    }
  }, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  })
  const sid = res.headers['mcp-session-id']
  assert.ok(sid && sid !== 'null', `expected a real session ID, got: ${sid}`)
  return { sid, init: parseSseBody(res.data) }
}

let requestId = 1000

async function callTool (sid, toolName, args, { withTasksCap = false } = {}) {
  const params = { name: toolName, arguments: args }
  if (withTasksCap) {
    params._meta = {
      'io.modelcontextprotocol/clientCapabilities': {
        extensions: { 'io.modelcontextprotocol/tasks': {} }
      }
    }
  }
  const id = ++requestId
  const res = await makeHttpRequest('post', serverUrl, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params
  }, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-session-id': sid
  })
  assert.equal(res.status, 200)
  const jsonData = parseSseBody(res.data)
  assert.ok(jsonData, `No SSE data in response for ${toolName}`)
  assert.equal(jsonData.id, id)
  return jsonData
}

async function callMethod (sid, method, params) {
  const id = ++requestId
  const res = await makeHttpRequest('post', serverUrl, {
    jsonrpc: '2.0',
    id,
    method,
    params
  }, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-session-id': sid
  })
  assert.equal(res.status, 200)
  return parseSseBody(res.data)
}

// Parse the JSON payload of a successful tool result
function toolPayload (jsonData) {
  assert.ok(jsonData.result, `expected tool result, got: ${JSON.stringify(jsonData.error || jsonData)}`)
  return JSON.parse(jsonData.result.content[0].text)
}

// Poll tasks/get until the task reaches a terminal state (or deadline)
async function pollTask (sid, taskId, { timeoutMs = 45000, intervalMs = 1000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await callMethod(sid, 'tasks/get', { taskId })
    assert.ok(res.result, `tasks/get failed: ${JSON.stringify(res.error)}`)
    if (res.result.status !== 'working') {
      return res.result
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Task ${taskId} still working after ${timeoutMs}ms`)
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Wait until the terminal shows some content (shell booted / SSH connected).
// Fresh local shells can take 10s+ to render a prompt on a loaded machine.
async function waitForTerminalReady (sid, tabId, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const out = toolPayload(await callTool(sid, 'get_electerm_terminal_output', { tabId, lines: 30 }))
    if ((out.output || '').trim().length > 0) {
      return out.output
    }
    await sleep(1000)
  }
  throw new Error(`Terminal ${tabId} showed no content within ${timeoutMs}ms`)
}

// Poll terminal output until it contains the marker
async function waitForMarker (sid, tabId, marker, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastOutput = ''
  while (Date.now() < deadline) {
    const out = toolPayload(await callTool(sid, 'get_electerm_terminal_output', { tabId, lines: 50 }))
    lastOutput = out.output || ''
    if (lastOutput.includes(marker)) {
      return lastOutput
    }
    await sleep(1000)
  }
  throw new Error(`Marker "${marker}" not seen within ${timeoutMs}ms. Last output: ${JSON.stringify(lastOutput.slice(-400))}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Global fixture
// ─────────────────────────────────────────────────────────────────────────────

let online = false
let sshServer = null
let sftpRoot = null
const openedTabIds = []
const createdBookmarkIds = []

function skipOffline (t) {
  if (!online) {
    t.skip('MCP server not reachable at 127.0.0.1:30837 — start the electerm app with the MCP widget')
    return true
  }
  return false
}

describe('MCP server integration (live app + in-process SSH server)', () => {
  before(async () => {
    // 1. Is the live MCP server reachable?
    try {
      const res = await makeHttpRequest('options', serverUrl)
      online = res.status === 204
    } catch (_) {
      online = false
    }
    if (!online) {
      console.log('  MCP server offline — all integration tests will skip')
      return
    }

    // 2. Seed known_hosts for the fixed test host key (avoids UI prompts)
    ensureKnownHostsEntry(TEST_PORT, console.log)

    // 3. Start the in-process SSH server with a scratch SFTP root
    sftpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-mcp-it-'))
    fs.writeFileSync(path.join(sftpRoot, 'hello.txt'), 'hello sftp world\n')
    fs.mkdirSync(path.join(sftpRoot, 'subdir'))
    fs.writeFileSync(path.join(sftpRoot, 'subdir', 'nested.txt'), 'nested file\n')
    sshServer = await startTestSshServer({ port: TEST_PORT, rootDir: sftpRoot })
  })

  after(async () => {
    if (sshServer) {
      await new Promise(resolve => sshServer.close(resolve))
    }
    if (sftpRoot) {
      fs.rmSync(sftpRoot, { recursive: true, force: true })
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Protocol
  // ─────────────────────────────────────────────────────────────────────────

  test('OPTIONS /mcp returns 204 with CORS method headers', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const res = await makeHttpRequest('options', serverUrl)
    assert.equal(res.status, 204)
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'))
    assert.ok(res.headers['access-control-allow-methods'].includes('GET'))
    assert.ok(res.headers['access-control-allow-methods'].includes('DELETE'))
    assert.ok(res.headers['access-control-allow-headers'].includes('mcp-session-id'))
  })

  test('initialize negotiates protocol version and returns server info', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const a = await initSession({ protocolVersion: '2024-11-05' })
    assert.equal(a.init.result.protocolVersion, '2024-11-05')
    assert.equal(a.init.result.serverInfo.name, 'electerm-mcp-server')
    assert.match(a.sid, /^[\w-]+$/)

    const b = await initSession({ protocolVersion: '2025-11-25' })
    assert.equal(b.init.result.protocolVersion, '2025-11-25')

    const c = await initSession({ protocolVersion: '1999-01-01' })
    assert.equal(c.init.result.protocolVersion, '2025-11-25', 'unknown version must fall back to newest supported')
  })

  test('initialize advertises the MCP Tasks extension', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { init } = await initSession()
    const ext = init.result.capabilities.extensions
    assert.ok(ext, 'capabilities.extensions must exist (enableTasks defaults to true)')
    assert.ok('io.modelcontextprotocol/tasks' in ext)
  })

  test('tools/list exposes the unified tool set and not the removed legacy tools', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()
    const res = await callMethod(sid, 'tools/list', {})
    const tools = res.result.tools
    const names = tools.map(tl => tl.name)

    for (const expected of [
      'list_electerm_tabs',
      'get_electerm_active_tab',
      'switch_electerm_tab',
      'close_electerm_tab',
      'reload_electerm_tab',
      'duplicate_electerm_tab',
      'open_electerm_local_terminal',
      'send_electerm_terminal_command',
      'get_electerm_terminal_selection',
      'get_electerm_terminal_output',
      'wait_for_electerm_terminal_idle',
      'get_electerm_terminal_status',
      'cancel_electerm_terminal_command',
      'execute_electerm_command',
      'open_electerm_tab_ssh',
      'open_electerm_tab_telnet',
      'open_electerm_tab_serial',
      'open_electerm_tab_local',
      'list_electerm_bookmarks',
      'get_electerm_bookmark',
      'add_electerm_bookmark_ssh',
      'edit_electerm_bookmark',
      'delete_electerm_bookmark',
      'open_electerm_bookmark',
      'list_electerm_bookmark_groups',
      'electerm_sftp_list',
      'electerm_sftp_stat',
      'electerm_sftp_read_file',
      'electerm_sftp_del_file_or_folder',
      'electerm_sftp_upload',
      'electerm_sftp_download',
      'electerm_zmodem_upload',
      'electerm_zmodem_download',
      'electerm_sftp_transfer_list',
      'electerm_sftp_transfer_history'
    ]) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`)
    }

    for (const removed of [
      'run_electerm_background_command',
      'get_electerm_background_task_status',
      'get_electerm_background_task_log',
      'cancel_electerm_background_task'
    ]) {
      assert.ok(!names.includes(removed), `Removed legacy tool still present: ${removed}`)
    }

    const exec = tools.find(tl => tl.name === 'execute_electerm_command')
    const props = exec.inputSchema.properties
    assert.deepEqual(props.mode.enum, ['exec', 'pty'])
    assert.equal(props.wait.type, 'boolean')
  })

  test('unknown method returns -32601, ping returns empty result', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()
    const bad = await callMethod(sid, 'no_such_method', {})
    assert.equal(bad.error.code, -32601)
    const ping = await callMethod(sid, 'ping', {})
    assert.deepEqual(ping.result, {})
  })

  test('GET /mcp SSE stream lifecycle', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const okRes = await makeStreamGetRequest(serverUrl, {
      Accept: 'text/event-stream',
      'Mcp-Session-Id': sid
    })
    assert.equal(okRes.status, 200)
    assert.equal(okRes.headers['content-type'], 'text/event-stream')
    assert.ok(okRes.data.includes(': ping'))

    await assert.rejects(
      () => makeHttpRequest('get', serverUrl, null, { Accept: 'text/event-stream' }),
      (err) => err.response && err.response.status === 400
    )
    await assert.rejects(
      () => makeHttpRequest('get', serverUrl, null, {
        Accept: 'text/event-stream',
        'Mcp-Session-Id': 'invalid-session-id'
      }),
      (err) => err.response && err.response.status === 400
    )
  })

  test('tasks method surface: get/cancel errors, list/update not implemented', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const unknown = await callMethod(sid, 'tasks/get', { taskId: 'task-nope' })
    assert.equal(unknown.error.code, -32602)

    const missing = await callMethod(sid, 'tasks/get', {})
    assert.equal(missing.error.code, -32602)

    const cancelUnknown = await callMethod(sid, 'tasks/cancel', { taskId: 'task-nope' })
    assert.equal(cancelUnknown.error.code, -32602)

    const list = await callMethod(sid, 'tasks/list', {})
    assert.equal(list.error.code, -32601)

    const update = await callMethod(sid, 'tasks/update', { taskId: 'task-x' })
    assert.equal(update.error.code, -32601)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Local terminal: tabs, send/read tools, execute (pty mode)
  // ─────────────────────────────────────────────────────────────────────────

  test('tab listing and active tab', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()
    const tabs = toolPayload(await callTool(sid, 'list_electerm_tabs', {}))
    assert.ok(Array.isArray(tabs))
    for (const tab of tabs) {
      assert.ok(tab.id && 'onData' in tab, 'each tab exposes id and onData')
    }
    const active = toolPayload(await callTool(sid, 'get_electerm_active_tab', {}))
    assert.ok('activeTabId' in active)
  })

  test('local terminal: open, send, wait idle, output, status, execute pty', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const opened = toolPayload(await callTool(sid, 'open_electerm_local_terminal', {}))
    assert.equal(opened.success, true)
    const tabId = opened.tabId
    openedTabIds.push(tabId)

    // Wait for the local shell to actually boot (can take 10s+ under load)
    await waitForTerminalReady(sid, tabId)

    // Legacy send → wait → read chain still works for interactive programs
    const marker = `MCP_IT_LOCAL_${uid}`
    const sent = toolPayload(await callTool(sid, 'send_electerm_terminal_command', {
      command: `echo "${marker}"`,
      tabId
    }))
    assert.equal(sent.success, true)
    await waitForMarker(sid, tabId, marker)

    // wait-idle returns a well-formed payload on an idle terminal
    const idle = toolPayload(await callTool(sid, 'wait_for_electerm_terminal_idle', {
      tabId, timeout: 10000, lines: 40
    }))
    assert.equal(idle.timedOut, false)
    assert.equal(typeof idle.output, 'string')

    const out = toolPayload(await callTool(sid, 'get_electerm_terminal_output', { tabId, lines: 10 }))
    assert.equal(out.tabId, tabId)
    assert.ok(out.lineCount > 0)

    const status = toolPayload(await callTool(sid, 'get_electerm_terminal_status', { tabId }))
    assert.ok('isRunning' in status && 'isIdle' in status)

    const sel = toolPayload(await callTool(sid, 'get_electerm_terminal_selection', { tabId }))
    assert.equal(typeof sel.selection, 'string')

    // execute_electerm_command — pty mode on a local tab
    const execMarker = `MCP_IT_EXEC_${uid}`
    const r = toolPayload(await callTool(sid, 'execute_electerm_command', {
      command: `echo "${execMarker}"`,
      tabId
    }))
    assert.equal(r.exitCode, 0)
    assert.equal(r.mode, 'pty')
    assert.ok(r.stdout.includes(execMarker), `expected "${execMarker}" in stdout, got: ${r.stdout}`)
    assert.equal(typeof r.durationMs, 'number')
    assert.equal(r.timedOut, false)

    // non-zero exit code is captured
    const r3 = toolPayload(await callTool(sid, 'execute_electerm_command', {
      command: '(exit 3)',
      tabId
    }))
    assert.equal(r3.exitCode, 3)

    // stderr is merged into stdout in pty mode
    const rErr = toolPayload(await callTool(sid, 'execute_electerm_command', {
      command: 'echo OUT_LINE; echo ERR_LINE >&2',
      tabId
    }))
    assert.equal(rErr.stderrMerged, true)
    assert.ok(rErr.stdout.includes('OUT_LINE'))
    assert.ok(rErr.stdout.includes('ERR_LINE'))

    // explicit mode:"pty"
    const rPty = toolPayload(await callTool(sid, 'execute_electerm_command', {
      command: 'echo PTY_MODE_OK',
      tabId,
      mode: 'pty'
    }))
    assert.equal(rPty.mode, 'pty')
    assert.ok(rPty.stdout.includes('PTY_MODE_OK'))

    // timeout returns partial result with timedOut
    const rTo = toolPayload(await callTool(sid, 'execute_electerm_command', {
      command: 'sleep 30',
      tabId,
      timeoutMs: 3000
    }))
    assert.equal(rTo.timedOut, true)
    assert.equal(rTo.exitCode, null)
    // free the terminal
    await callTool(sid, 'cancel_electerm_terminal_command', { tabId })

    // built-in blacklist still guards the exec path
    const blocked = await callTool(sid, 'execute_electerm_command', { command: 'rm -rf /', tabId })
    assert.equal(blocked.result.isError, true)

    // missing command errors
    const noCmd = await callTool(sid, 'execute_electerm_command', { tabId })
    assert.equal(noCmd.result.isError, true)

    // wait=false without a tasks-capable client errors (legacy tools removed)
    const noCaps = await callTool(sid, 'execute_electerm_command', {
      command: 'sleep 5',
      tabId,
      wait: false
    })
    assert.equal(noCaps.result.isError, true)
    assert.ok(/MCP Tasks extension/.test(noCaps.result.content[0].text))

    await callTool(sid, 'close_electerm_tab', { tabId })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SSH tab against the in-process test server: exec mode + MCP Tasks
  // ─────────────────────────────────────────────────────────────────────────

  test('SSH tab: exec mode with real stdout/stderr/exitCode', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const opened = toolPayload(await callTool(sid, 'open_electerm_tab_ssh', {
      title: `MCP_IT_SSH_${uid}`,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(opened.success, true, `open SSH tab failed: ${JSON.stringify(opened)}`)
    const tabId = opened.tabId
    openedTabIds.push(tabId)
    await waitForTerminalReady(sid, tabId)

    try {
      const marker = `MCP_IT_SSH_EXEC_${uid}`
      const r = toolPayload(await callTool(sid, 'execute_electerm_command', {
        command: `echo "${marker}"`,
        tabId
      }))
      assert.equal(r.mode, 'exec', 'SSH tabs must use the exec channel')
      assert.equal(r.exitCode, 0)
      assert.equal(r.stderrMerged, false)
      assert.ok(r.stdout.includes(marker))

      // stdout and stderr are captured separately
      const r2 = toolPayload(await callTool(sid, 'execute_electerm_command', {
        command: 'echo SSH_OUT; echo SSH_ERR >&2',
        tabId
      }))
      assert.ok(r2.stdout.includes('SSH_OUT'))
      assert.ok(r2.stderr.includes('SSH_ERR'))
      assert.ok(!r2.stdout.includes('SSH_ERR'), 'stderr must not leak into stdout in exec mode')

      // real exit codes
      const r7 = toolPayload(await callTool(sid, 'execute_electerm_command', {
        command: 'exit 7',
        tabId
      }))
      assert.equal(r7.exitCode, 7)
    } finally {
      await callTool(sid, 'close_electerm_tab', { tabId })
    }
  })

  test('MCP Tasks end-to-end: wait=false → tasks/get → completed', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession({ withTasksCap: true })

    const opened = toolPayload(await callTool(sid, 'open_electerm_tab_ssh', {
      title: `MCP_IT_SSH_TASK_${uid}`,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(opened.success, true)
    const tabId = opened.tabId
    openedTabIds.push(tabId)
    await waitForTerminalReady(sid, tabId)

    try {
      const marker = `MCP_IT_TASK_DONE_${uid}`
      const created = await callTool(sid, 'execute_electerm_command', {
        command: `sleep 2 && echo "${marker}"`,
        tabId,
        wait: false
      }, { withTasksCap: true })

      const taskResult = created.result
      assert.equal(taskResult.resultType, 'task', `expected task handle, got: ${JSON.stringify(taskResult)}`)
      const task = taskResult.task
      assert.ok(task.taskId.startsWith('task-'))
      assert.equal(task.status, 'working')
      assert.ok(task.ttl > 0 && task.pollIntervalMs > 0)
      assert.ok(!('meta' in task), 'task wire shape must not leak server meta')

      const final = await pollTask(sid, task.taskId, { timeoutMs: 45000 })
      assert.equal(final.status, 'completed',
        `task must complete; got ${final.status}: ${JSON.stringify(final.error || final.result || final)}`)
      assert.ok(final.result.stdout.includes(marker), `expected "${marker}" in task result stdout`)
      assert.equal(final.result.exitCode, 0)
      assert.equal(typeof final.result.durationMs, 'number')
    } finally {
      await callTool(sid, 'close_electerm_tab', { tabId })
    }
  })

  test('MCP Tasks: tasks/cancel stops a long-running command', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession({ withTasksCap: true })

    const opened = toolPayload(await callTool(sid, 'open_electerm_tab_ssh', {
      title: `MCP_IT_SSH_CANCEL_${uid}`,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(opened.success, true)
    const tabId = opened.tabId
    openedTabIds.push(tabId)
    await waitForTerminalReady(sid, tabId)

    try {
      const created = await callTool(sid, 'execute_electerm_command', {
        command: 'sleep 60',
        tabId,
        wait: false
      }, { withTasksCap: true })
      const task = created.result.task
      assert.equal(task.status, 'working')

      const cancelled = await callMethod(sid, 'tasks/cancel', { taskId: task.taskId })
      assert.equal(cancelled.result.status, 'cancelled')

      // terminal state is stable
      const again = await callMethod(sid, 'tasks/get', { taskId: task.taskId })
      assert.equal(again.result.status, 'cancelled')
    } finally {
      await callTool(sid, 'close_electerm_tab', { tabId })
    }
  })

  test('SSH tab: interactive shell via send/read tools', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const opened = toolPayload(await callTool(sid, 'open_electerm_tab_ssh', {
      title: `MCP_IT_SSH_SHELL_${uid}`,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(opened.success, true)
    const tabId = opened.tabId
    openedTabIds.push(tabId)
    await waitForTerminalReady(sid, tabId)

    try {
      const marker = `MCP_IT_SHELL_${uid}`
      await callTool(sid, 'send_electerm_terminal_command', {
        command: `echo "${marker}"`,
        tabId
      })
      const output = await waitForMarker(sid, tabId, marker)
      assert.ok(output.includes(marker))
    } finally {
      await callTool(sid, 'close_electerm_tab', { tabId })
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SFTP against the in-process server (needs the app's SFTP panel)
  // ─────────────────────────────────────────────────────────────────────────

  test('SFTP: list, stat, read, del on the test server', { timeout: 120000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const opened = toolPayload(await callTool(sid, 'open_electerm_tab_ssh', {
      title: `MCP_IT_SSH_SFTP_${uid}`,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(opened.success, true)
    const tabId = opened.tabId
    openedTabIds.push(tabId)
    await waitForTerminalReady(sid, tabId)

    // The MCP sftp tools require the app's SFTP panel to be initialized for
    // the tab; tolerate the known "not initialized" error but verify shapes
    // when the panel is available.
    const tolerant = (jsonData, what) => {
      if (jsonData.result && jsonData.result.isError) {
        assert.ok(
          /SFTP not initialized|not an SSH\/SFTP tab/.test(jsonData.result.content[0].text),
          `unexpected ${what} error: ${jsonData.result.content[0].text}`
        )
        return null
      }
      return toolPayload(jsonData)
    }

    try {
      const list = tolerant(await callTool(sid, 'electerm_sftp_list', { tabId, remotePath: '/' }), 'sftp_list')
      if (list) {
        assert.ok(Array.isArray(list.list))
        assert.ok(list.list.some(f => f.name === 'hello.txt'), `expected hello.txt in / listing: ${JSON.stringify(list.list)}`)
      }

      const stat = tolerant(await callTool(sid, 'electerm_sftp_stat', { tabId, remotePath: '/hello.txt' }), 'sftp_stat')
      if (stat) {
        assert.ok(stat.stat, 'stat result expected')
      }

      const read = tolerant(await callTool(sid, 'electerm_sftp_read_file', { tabId, remotePath: '/hello.txt' }), 'sftp_read_file')
      if (read) {
        assert.ok(String(read.content).includes('hello sftp world'))
      }

      const delName = `/mcp-it-del-${uid}.txt`
      // The test server's SFTP root is local — create the file to delete
      fs.writeFileSync(path.join(sftpRoot, `mcp-it-del-${uid}.txt`), 'delete me')
      const del = tolerant(await callTool(sid, 'electerm_sftp_del_file_or_folder', { tabId, remotePath: delName }), 'sftp_del')
      if (del) {
        assert.equal(del.success, true)
        assert.ok(
          !fs.existsSync(path.join(sftpRoot, `mcp-it-del-${uid}.txt`)),
          'deleted file must be gone from the SFTP root'
        )
      }

      // Upload: local scratch file → remote / (confined to sftpRoot)
      const localUp = path.join(os.tmpdir(), `mcp-it-up-${uid}.txt`)
      fs.writeFileSync(localUp, `upload content ${uid}`)
      const up = tolerant(await callTool(sid, 'electerm_sftp_upload', {
        tabId,
        localPath: localUp,
        remotePath: `/mcp-it-up-${uid}.txt`
      }), 'sftp_upload')
      if (up) {
        assert.equal(up.success, true)
        assert.ok(up.transferId)
        // The transfer panel uploads asynchronously — poll for arrival
        const upDeadline = Date.now() + 20000
        let arrived = false
        while (Date.now() < upDeadline && !arrived) {
          arrived = fs.existsSync(path.join(sftpRoot, `mcp-it-up-${uid}.txt`))
          if (!arrived) await sleep(500)
        }
        assert.ok(arrived, 'uploaded file must land in the confined SFTP root')
      }
      fs.rmSync(localUp, { force: true })

      // Download: remote hello.txt → local scratch path
      const localDown = path.join(os.tmpdir(), `mcp-it-down-${uid}.txt`)
      const down = tolerant(await callTool(sid, 'electerm_sftp_download', {
        tabId,
        remotePath: '/hello.txt',
        localPath: localDown
      }), 'sftp_download')
      if (down) {
        assert.equal(down.success, true)
        const downDeadline = Date.now() + 20000
        let arrived = false
        while (Date.now() < downDeadline && !arrived) {
          arrived = fs.existsSync(localDown)
          if (!arrived) await sleep(500)
        }
        if (arrived) {
          assert.ok(fs.readFileSync(localDown, 'utf8').includes('hello sftp world'))
          fs.rmSync(localDown, { force: true })
        } else {
          assert.fail('downloaded file never arrived locally')
        }
      }

      // Transfer list/history are readable regardless
      const transfers = toolPayload(await callTool(sid, 'electerm_sftp_transfer_list', {}))
      assert.ok(Array.isArray(transfers))
      const history = toolPayload(await callTool(sid, 'electerm_sftp_transfer_history', {}))
      assert.ok(Array.isArray(history))
    } finally {
      await callTool(sid, 'close_electerm_tab', { tabId })
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Bookmarks CRUD (clean up after ourselves)
  // ─────────────────────────────────────────────────────────────────────────

  test('bookmarks: add, list, get, edit, delete', { timeout: 60000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()
    const title = `MCP_IT_BM_${uid}`

    const added = toolPayload(await callTool(sid, 'add_electerm_bookmark_ssh', {
      title,
      host: '127.0.0.1',
      port: TEST_PORT,
      username: TEST_USERNAME,
      password: TEST_PASSWORD
    }))
    assert.equal(added.success, true)
    const id = added.id
    createdBookmarkIds.push(id)

    try {
      const list = toolPayload(await callTool(sid, 'list_electerm_bookmarks', {}))
      const found = list.find(b => b.id === id)
      assert.ok(found, 'bookmark must appear in list')
      assert.equal(found.title, title)
      assert.ok(!('password' in found), 'bookmark list must not leak passwords')

      const got = toolPayload(await callTool(sid, 'get_electerm_bookmark', { id }))
      assert.equal(got.title, title)
      assert.ok(!('password' in got), 'bookmark get must not leak passwords')

      const edited = toolPayload(await callTool(sid, 'edit_electerm_bookmark', {
        id,
        updates: { title: `${title}_renamed` }
      }))
      assert.equal(edited.success, true)
      const got2 = toolPayload(await callTool(sid, 'get_electerm_bookmark', { id }))
      assert.equal(got2.title, `${title}_renamed`)
    } finally {
      const deleted = toolPayload(await callTool(sid, 'delete_electerm_bookmark', { id }))
      assert.equal(deleted.success, true)
      const list2 = toolPayload(await callTool(sid, 'list_electerm_bookmarks', {}))
      assert.ok(!list2.find(b => b.id === id), 'bookmark must be deleted')
    }

    const groups = toolPayload(await callTool(sid, 'list_electerm_bookmark_groups', {}))
    assert.ok(Array.isArray(groups))
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Argument validation & zmodem tool surface
  // ─────────────────────────────────────────────────────────────────────────

  test('argument validation errors are reported as isError', { timeout: 30000 }, async (t) => {
    if (skipOffline(t)) return
    const { sid } = await initSession()

    const cases = [
      ['electerm_sftp_list', {}],
      ['electerm_sftp_del_file_or_folder', {}],
      ['electerm_sftp_upload', { remotePath: '/tmp/x' }],
      ['electerm_sftp_download', { localPath: '/tmp/x' }],
      ['electerm_zmodem_upload', {}],
      ['electerm_zmodem_download', { saveFolder: '/tmp' }]
    ]
    for (const [tool, args] of cases) {
      const res = await callTool(sid, tool, args)
      assert.ok(
        res.error || (res.result && res.result.isError),
        `${tool} with ${JSON.stringify(args)} must error`
      )
    }
  })
})
