/**
 * sftp_read_file must settle, in the AI agent and in the SFTP panel.
 *
 * It used to hang forever on any remote path that could not be opened (missing
 * file, a directory, permission denied): the server-side read helper only
 * listened for 'finish'/'error' on the *destination* stream, and pipe() does
 * not forward a source error, so its promise never settled, the sftp websocket
 * never answered, and the agent tool card span indefinitely.
 *
 * The provider here is a local stub that always asks for sftp_read_file on a
 * path that does not exist, so the failure is deterministic and no real AI
 * service (or API key) is involved.
 */
const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const delay = require('./common/wait')
const baseAppOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { setupSshConnection } = require('./common/common')
const {
  startTestSshServer,
  stopTestSshServer,
  ensureKnownHostsEntry,
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_PORT
} = require('../integration/lib/ssh-test-server')

it.setTimeout(240000)

const AI_PORT = 43439
const MISSING_PATH = '/definitely-not-here-' + Date.now() + '.txt'

// Stub provider: the first call asks for sftp_read_file on a missing path, the
// call after the tool result is a plain answer, so the agent loop terminates.
function startStubAI () {
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      let payload = {}
      try {
        payload = JSON.parse(body)
      } catch (_) {}
      const messages = payload.messages || []
      calls.push(messages.map((m) => m.role))
      const hasToolResult = messages.some((m) => m.role === 'tool')
      const message = hasToolResult
        ? { role: 'assistant', content: 'read failed as expected' }
        : {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_read_1',
              type: 'function',
              function: {
                name: 'sftp_read_file',
                arguments: JSON.stringify({ remotePath: MISSING_PATH })
              }
            }]
          }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: 'stub',
        object: 'chat.completion',
        model: 'stub',
        choices: [{ index: 0, message, finish_reason: hasToolResult ? 'stop' : 'tool_calls' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }))
    })
  })
  return new Promise((resolve) => {
    server.listen(AI_PORT, '127.0.0.1', () => resolve({ server, calls }))
  })
}

describe('AI agent sftp_read_file', function () {
  let sshServer
  let stub
  let electronApp
  let client
  let sftpRoot
  let dataDir

  it.beforeAll(async () => {
    sftpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-agent-sftp-'))
    fs.writeFileSync(path.join(sftpRoot, 'hello.txt'), 'hello sftp world\n')
    sshServer = await startTestSshServer({ rootDir: sftpRoot, port: TEST_PORT })
    ensureKnownHostsEntry(TEST_PORT)
    stub = await startStubAI()
  })

  it.afterAll(async () => {
    if (stub) stub.server.close()
    if (sshServer) await stopTestSshServer(sshServer)
    if (sftpRoot) fs.rmSync(sftpRoot, { recursive: true, force: true })
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it.beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-agent-data-'))
    const appOptions = {
      ...baseAppOptions,
      env: { ...baseAppOptions.env, DATA_PATH: dataDir }
    }
    electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4000)
  })

  it.afterEach(async () => {
    if (electronApp) await electronApp.close()
  })

  // Connect an SSH tab to the in-process test server and open the SFTP pane --
  // that pane is what registers the `sftp-<tabId>` reference the tool needs.
  async function openSftpTab () {
    await setupSshConnection(client, {
      host: '127.0.0.1',
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      port: String(TEST_PORT)
    })
    await client.click('.session-current .term-sftp-tabs .type-tab', 1)
    await delay(3000)
  }

  it('settles when the remote path cannot be opened', async function () {
    await openSftpTab()

    const outcome = await client.evaluate(async ({ missing, good }) => {
      const store = window.store
      const tabId = store.activeTabId
      const run = (p) => Promise.race([
        store.mcpSftpReadFile({ tabId, remotePath: p }).then(
          (r) => ({ ok: true, content: String(r.content).slice(0, 40) }),
          (e) => ({ ok: false, error: e.message })
        ),
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: false, error: 'TIMEOUT: never settled' }), 15000)
        })
      ])
      return { missing: await run(missing), good: await run(good) }
    }, { missing: MISSING_PATH, good: '/hello.txt' })

    // The regression: this used to be a 15s timeout instead of an error.
    expect(outcome.missing.error).not.toContain('TIMEOUT')
    expect(outcome.missing.ok).toBe(false)
    expect(outcome.good.ok).toBe(true)
    expect(outcome.good.content).toContain('hello sftp world')
  })

  it('leaves the agent tool card in a finished state', async function () {
    await openSftpTab()

    await client.evaluate(() => {
      window.localStorage.setItem('ai-chat-mode', 'agent')
    })
    await client.evaluate((port) => window.store.setConfig({
      baseURLAI: `http://127.0.0.1:${port}`,
      apiPathAI: '/chat/completions',
      modelAI: 'stub',
      apiKeyAI: 'stub-key',
      showCmdSuggestions: false
    }), AI_PORT)

    await client.evaluate(() => window.store.toggleAIPanel())
    await delay(1200)
    await expect(client.locator('.ai-chat-container')).toBeVisible()

    const ta = client.locator('.ai-chat-textarea')
    await ta.click({ force: true })
    await ta.fill('read a file over sftp')
    await delay(300)
    // Enter submits (handleKeyPress). Clicking the footer send icon is blocked
    // by the connection notification that sits over it.
    await ta.press('Enter')

    // The card must leave "running" -- that is the whole point. Before the fix
    // it stayed in .agent-tool-running and the panel was locked for good.
    await client.waitForSelector(
      '.agent-tool-call-card.agent-tool-completed, .agent-tool-call-card.agent-tool-error',
      { timeout: 45000 }
    )
    expect(await client.locator('.agent-tool-call-card.agent-tool-running').count()).toBe(0)
    expect(await client.locator('.agent-tool-call-card').count()).toBe(1)
    expect(await client.locator('.agent-tool-name').first().textContent()).toBe('sftp_read_file')

    // The tool reported the real reason, not a generic "connection closed".
    const result = await client.evaluate(() => {
      const hist = window.store.aiChatHistory || []
      const entry = [...hist].reverse().find((h) => h.toolCalls && h.toolCalls.length)
      return entry ? entry.toolCalls[0].result : null
    })
    expect(String(result)).toContain('No such file')

    // And the loop kept going: the stub answered a second time.
    expect(stub.calls.length).toBeGreaterThan(1)
  })
})
