const { test, describe, before } = require('node:test')
const assert = require('assert/strict')
const axios = require('axios')

const serverUrl = 'http://127.0.0.1:30837/mcp'

// Helper function to make HTTP requests
async function makeHttpRequest (method, urlStr, data = null, headers = {}) {
  try {
    const response = await axios({
      method: method.toUpperCase(),
      url: urlStr,
      data,
      headers
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
    } else {
      throw error
    }
  }
}

// Helper function to initialize MCP session
async function initSession () {
  const initializeRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'electerm-test-client',
        version: '1.0.0'
      }
    }
  }

  const response = await makeHttpRequest('post', serverUrl, initializeRequest, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  })

  const sid = response.headers['mcp-session-id']
  assert.ok(sid && sid !== 'null', `initSession: expected a real session ID but got: ${sid}`)
  return sid
}

// Helper: call a tool and parse the SSE response into JSON result/error
async function callTool (sid, id, toolName, args) {
  const response = await makeHttpRequest('post', serverUrl, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-session-id': sid
  })
  assert.equal(response.status, 200)
  const dataLine = response.data.split('\n').find(l => l.startsWith('data: '))
  assert.ok(dataLine, `No data line in SSE response for ${toolName}`)
  const jsonData = JSON.parse(dataLine.substring(6))
  assert.equal(jsonData.jsonrpc, '2.0')
  assert.equal(jsonData.id, id)
  return jsonData
}

// Helper: check if renderer is available by trying list_electerm_tabs
async function checkRenderer (sid) {
  const jsonData = await callTool(sid, 999, 'list_electerm_tabs', {})
  return !jsonData.error
}

describe('mcp-widget', function () {
  let sessionId = null
  let hasRenderer = false

  before(async () => {
    sessionId = await initSession()
    hasRenderer = await checkRenderer(sessionId)
    if (!hasRenderer) {
      console.log('No renderer detected — renderer-dependent tests will be skipped')
    }
  })

  // ─── Protocol-level tests (no renderer needed) ──────────────────────────

  test('should be accessible at http://127.0.0.1:30837/mcp with default settings', { timeout: 100000 }, async function () {
    const optionsResponse = await makeHttpRequest('options', serverUrl)
    assert.equal(optionsResponse.status, 204)
    assert.equal(optionsResponse.headers['access-control-allow-origin'], undefined)
    assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('POST'))
    assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('GET'))
    assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('DELETE'))
    assert.ok(optionsResponse.headers['access-control-allow-headers'].includes('mcp-session-id'))
  })

  test('should respond to MCP initialize request', { timeout: 100000 }, async function () {
    const initializeRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'electerm-test-client',
          version: '1.0.0'
        }
      }
    }

    const response = await makeHttpRequest('post', serverUrl, initializeRequest, {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], 'text/event-stream')
    const returnedSessionId = response.headers['mcp-session-id']
    assert.ok(returnedSessionId, 'mcp-session-id header is missing')
    assert.notEqual(returnedSessionId, 'null', 'mcp-session-id must not be the string "null"')
    assert.match(returnedSessionId, /^[\w-]+$/, 'mcp-session-id must be a valid identifier')

    // Parse SSE response
    const sseData = response.data
    assert.ok(sseData.includes('event: message'))
    assert.ok(sseData.includes('data: '))

    const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
    assert.ok(dataLine)
    const jsonData = JSON.parse(dataLine.substring(6))

    assert.equal(jsonData.jsonrpc, '2.0')
    assert.equal(jsonData.id, 1)
    assert.ok(jsonData.result)
    assert.equal(jsonData.result.protocolVersion, '2024-11-05')
    assert.ok(jsonData.result.serverInfo)
    assert.equal(jsonData.result.serverInfo.name, 'electerm-mcp-server')
  })

  test('should list available tools', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }

    const response = await makeHttpRequest('post', serverUrl, toolsRequest, {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': sessionId
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], 'text/event-stream')

    const sseData = response.data
    assert.ok(sseData.includes('event: message'))
    assert.ok(sseData.includes('data: '))

    const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
    assert.ok(dataLine)
    const jsonData = JSON.parse(dataLine.substring(6))

    assert.equal(jsonData.jsonrpc, '2.0')
    assert.equal(jsonData.id, 2)
    assert.ok(jsonData.result)
    assert.ok(Array.isArray(jsonData.result.tools))
    assert.ok(jsonData.result.tools.length > 0)

    const toolNames = jsonData.result.tools.map(tool => tool.name)
    assert.ok(toolNames.includes('list_electerm_tabs'))
    assert.ok(toolNames.includes('get_electerm_active_tab'))
    assert.ok(toolNames.includes('send_electerm_terminal_command'))
    assert.ok(toolNames.includes('get_electerm_terminal_status'))
    assert.ok(toolNames.includes('cancel_electerm_terminal_command'))
    assert.ok(toolNames.includes('run_electerm_background_command'))
    assert.ok(toolNames.includes('get_electerm_background_task_status'))
    assert.ok(toolNames.includes('get_electerm_background_task_log'))
    assert.ok(toolNames.includes('cancel_electerm_background_task'))
  })

  // ─── Tool call protocol tests ───────────────────────────────────────────

  test('should return error when calling tool without renderer', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const jsonData = await callTool(sessionId, 3, 'open_electerm_local_terminal', {})

    if (hasRenderer) {
      // With renderer: tool call should succeed
      assert.ok(jsonData.result, 'Expected success result with renderer')
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.equal(result.success, true)
    } else {
      // Without renderer: should get a JSON-RPC error
      assert.ok(jsonData.error, 'Expected error without renderer')
      assert.ok(jsonData.error.code !== undefined, 'Error must have a code')
      assert.ok(jsonData.error.message.length > 0, 'Error must have a message')
    }
  })

  test('should handle multiple tool calls in sequence', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const toolNames = ['list_electerm_tabs', 'get_electerm_active_tab', 'get_electerm_terminal_selection']

    for (let i = 0; i < toolNames.length; i++) {
      const jsonData = await callTool(sessionId, 10 + i, toolNames[i], {})

      // Each call must return a valid JSON-RPC response (result or error)
      assert.ok(
        jsonData.result || jsonData.error,
        `Tool ${toolNames[i]} must return either result or error`
      )
    }
  })

  // ─── Renderer-dependent terminal tests ──────────────────────────────────

  test('should open local terminal and run command', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    // Step 1: Open a local terminal
    const openData = await callTool(sessionId, 20, 'open_electerm_local_terminal', {})
    assert.ok(openData.result, 'open_local_terminal should succeed')
    const openResult = JSON.parse(openData.result.content[0].text)
    assert.equal(openResult.success, true)
    assert.ok(openResult.message.includes('local terminal'))

    // Wait for terminal to initialize
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Step 2: Send a command
    const uniqueId = Date.now()
    const testCommand = `echo "MCP_TEST_${uniqueId}"`

    const cmdData = await callTool(sessionId, 21, 'send_electerm_terminal_command', {
      command: testCommand
    })
    assert.ok(cmdData.result, 'send_terminal_command should succeed')
    const cmdResult = JSON.parse(cmdData.result.content[0].text)
    assert.equal(cmdResult.success, true)

    // Wait for command to execute
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 3: Get terminal output and verify command was executed
    const outputData = await callTool(sessionId, 22, 'get_electerm_terminal_output', {
      lines: 20
    })
    assert.ok(outputData.result, 'get_terminal_output should succeed')
    const outputResult = JSON.parse(outputData.result.content[0].text)
    assert.ok(outputResult.output !== undefined)
    assert.ok(outputResult.lineCount > 0)
    assert.ok(
      outputResult.output.includes(`MCP_TEST_${uniqueId}`),
      `Expected command output "MCP_TEST_${uniqueId}" in terminal`
    )
  })

  test('should get terminal output', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 30, 'get_electerm_terminal_output', {
      lines: 10
    })
    assert.ok(jsonData.result, 'get_terminal_output should succeed')
    const result = JSON.parse(jsonData.result.content[0].text)
    assert.ok(result.output !== undefined)
    assert.ok(result.tabId !== undefined)
    assert.equal(typeof result.lineCount, 'number')
  })

  test('should create SSH bookmark, connect, run command and get output', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const {
      TEST_HOST,
      TEST_PASS,
      TEST_USER,
      TEST_PORT
    } = require('../e2e/common/env')

    const uniqueId = Date.now()
    const bookmarkTitle = `MCP1_SSH_Test_${uniqueId}`

    // Step 1: Create SSH bookmark
    const addData = await callTool(sessionId, 40, 'add_electerm_bookmark_ssh', {
      title: bookmarkTitle,
      host: TEST_HOST,
      port: parseInt(TEST_PORT, 10),
      username: TEST_USER,
      password: TEST_PASS
    })
    assert.ok(addData.result, 'add_bookmark should succeed')
    const addResult = JSON.parse(addData.result.content[0].text)
    assert.equal(addResult.success, true)
    assert.ok(addResult.id !== undefined)
    const bookmarkId = addResult.id

    try {
      // Step 2: Open/connect to the bookmark
      const openData = await callTool(sessionId, 41, 'open_electerm_bookmark', {
        id: bookmarkId
      })
      assert.ok(openData.result, 'open_bookmark should succeed')
      const openResult = JSON.parse(openData.result.content[0].text)
      assert.equal(openResult.success, true)

      // Wait for SSH connection to establish
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Step 3: Send a command with retry
      const testMarker = `SSH_MCP_TEST_${uniqueId}`
      const testCommand = `echo "${testMarker}"`

      let cmdResult = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        const cmdData = await callTool(sessionId, 42, 'send_electerm_terminal_command', {
          command: testCommand
        })
        if (cmdData.error) {
          if (attempt === 3) {
            assert.fail(`send_command failed after 3 attempts: ${cmdData.error.message}`)
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        cmdResult = JSON.parse(cmdData.result.content[0].text)
        break
      }
      assert.equal(cmdResult.success, true)

      // Wait for command to execute
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 4: Get terminal output and verify command was executed
      const outputData = await callTool(sessionId, 43, 'get_electerm_terminal_output', {
        lines: 30
      })
      assert.ok(outputData.result, 'get_terminal_output should succeed')
      const outputResult = JSON.parse(outputData.result.content[0].text)
      assert.ok(outputResult.output !== undefined)
      assert.ok(outputResult.lineCount > 0)
      assert.ok(
        outputResult.output.includes(testMarker),
        `Expected SSH command output "${testMarker}" in terminal`
      )
    } finally {
      // Step 5: Clean up - delete the test bookmark
      const deleteData = await callTool(sessionId, 44, 'delete_electerm_bookmark', {
        id: bookmarkId
      })
      if (deleteData.result) {
        const deleteResult = JSON.parse(deleteData.result.content[0].text)
        assert.equal(deleteResult.success, true)
      }

      // Step 6: Verify the bookmark was actually deleted
      const listData = await callTool(sessionId, 45, 'list_electerm_bookmarks', {})
      assert.ok(listData.result, 'list_bookmarks should succeed')
      const bookmarks = JSON.parse(listData.result.content[0].text)
      const deletedBookmark = bookmarks.find(b => b.id === bookmarkId)
      assert.ok(!deletedBookmark, `Bookmark with ID ${bookmarkId} should have been deleted but was found`)
    }
  })

  test('should create Telnet bookmark', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const uniqueId = Date.now()
    const bookmarkTitle = `MCP1_Telnet_Test_${uniqueId}`

    // Create Telnet bookmark
    const addData = await callTool(sessionId, 50, 'add_electerm_bookmark_telnet', {
      title: bookmarkTitle,
      host: '127.0.0.1',
      port: 23,
      username: 'testuser',
      password: 'testpass'
    })
    assert.ok(addData.result, 'add_bookmark should succeed')
    const addResult = JSON.parse(addData.result.content[0].text)
    assert.equal(addResult.success, true)
    assert.ok(addResult.id !== undefined)
    const bookmarkId = addResult.id

    // Verify bookmark was created by listing bookmarks
    const listData = await callTool(sessionId, 51, 'list_electerm_bookmarks', {})
    assert.ok(listData.result, 'list_bookmarks should succeed')
    const bookmarks = JSON.parse(listData.result.content[0].text)
    const createdBookmark = bookmarks.find(b => b.id === bookmarkId)
    assert.ok(createdBookmark, `Bookmark with ID ${bookmarkId} not found in list`)
    assert.equal(createdBookmark.title, bookmarkTitle)
    assert.equal(createdBookmark.type, 'telnet')
  })

  // ─── Direct tab open tests ─────────────────────────────────────────────

  test('should open SSH tab directly without bookmark, run command and get output', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const {
      TEST_HOST,
      TEST_PASS,
      TEST_USER,
      TEST_PORT
    } = require('../e2e/common/env')

    const uniqueId = Date.now()
    const tabTitle = `MCP_Direct_SSH_${uniqueId}`

    // Step 1: Open SSH tab directly (no bookmark created)
    const openData = await callTool(sessionId, 70, 'open_electerm_tab_ssh', {
      title: tabTitle,
      host: TEST_HOST,
      port: parseInt(TEST_PORT, 10),
      username: TEST_USER,
      password: TEST_PASS
    })
    assert.ok(openData.result, 'open_tab_ssh should succeed')
    const openResult = JSON.parse(openData.result.content[0].text)
    assert.equal(openResult.success, true)
    assert.ok(openResult.tabId !== undefined)
    assert.equal(openResult.type, 'ssh')

    // Wait for SSH connection to establish
    await new Promise(resolve => setTimeout(resolve, 8000))

    try {
      // Step 2: Send a command with retry
      const testMarker = `SSH_DIRECT_TEST_${uniqueId}`
      const testCommand = `echo "${testMarker}"`

      let cmdResult = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        const cmdData = await callTool(sessionId, 71, 'send_electerm_terminal_command', {
          command: testCommand
        })
        if (cmdData.error) {
          if (attempt === 3) {
            assert.fail(`send_command failed after 3 attempts: ${cmdData.error.message}`)
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        cmdResult = JSON.parse(cmdData.result.content[0].text)
        break
      }
      assert.equal(cmdResult.success, true)

      // Wait for command to execute
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Get terminal output and verify command was executed
      const outputData = await callTool(sessionId, 72, 'get_electerm_terminal_output', {
        lines: 30
      })
      assert.ok(outputData.result, 'get_terminal_output should succeed')
      const outputResult = JSON.parse(outputData.result.content[0].text)
      assert.ok(outputResult.output !== undefined)
      assert.ok(
        outputResult.output.includes(testMarker),
        `Expected SSH command output "${testMarker}" in terminal`
      )

      // Step 4: Verify no bookmark was created for this connection
      const listData = await callTool(sessionId, 73, 'list_electerm_bookmarks', {})
      assert.ok(listData.result, 'list_bookmarks should succeed')
      const bookmarks = JSON.parse(listData.result.content[0].text)
      const foundBookmark = bookmarks.find(b => b.title === tabTitle)
      assert.ok(!foundBookmark, `No bookmark should be created for direct tab open, but found: ${JSON.stringify(foundBookmark)}`)
    } finally {
      // Step 5: Close the tab
      const tabId = openResult.tabId
      await callTool(sessionId, 74, 'close_electerm_tab', { tabId })
    }
  })

  test('should list direct open tools in tools/list', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const toolsRequest = {
      jsonrpc: '2.0',
      id: 75,
      method: 'tools/list',
      params: {}
    }

    const response = await makeHttpRequest('post', serverUrl, toolsRequest, {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': sessionId
    })

    assert.equal(response.status, 200)
    const dataLine = response.data.split('\n').find(l => l.startsWith('data: '))
    const jsonData = JSON.parse(dataLine.substring(6))
    const toolNames = jsonData.result.tools.map(tool => tool.name)

    assert.ok(toolNames.includes('open_electerm_tab_ssh'), 'Missing open_electerm_tab_ssh')
    assert.ok(toolNames.includes('open_electerm_tab_telnet'), 'Missing open_electerm_tab_telnet')
    assert.ok(toolNames.includes('open_electerm_tab_serial'), 'Missing open_electerm_tab_serial')
    assert.ok(toolNames.includes('open_electerm_tab_local'), 'Missing open_electerm_tab_local')
  })

  // ─── onData test ────────────────────────────────────────────────────────

  test('list_tabs should include onData field for each tab', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 60, 'list_electerm_tabs', {})
    assert.ok(jsonData.result, 'list_tabs should succeed')

    const tabs = JSON.parse(jsonData.result.content[0].text)
    assert.ok(Array.isArray(tabs), 'Expected an array of tabs')

    for (const tab of tabs) {
      assert.ok('onData' in tab, `Tab ${tab.id} is missing the onData field`)
      assert.equal(typeof tab.onData, 'string', `onData for tab ${tab.id} should be string`)
    }
  })

  // ─── Terminal idle tests ────────────────────────────────────────────────

  test('should wait for terminal idle after a quick echo command', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const openData = await callTool(sessionId, 61, 'open_electerm_local_terminal', {})
    assert.ok(openData.result, 'open_local_terminal should succeed')
    const openResult = JSON.parse(openData.result.content[0].text)
    assert.equal(openResult.success, true)

    await new Promise(resolve => setTimeout(resolve, 3000))

    const marker = `IDLE_TEST_${Date.now()}`

    const sendData = await callTool(sessionId, 62, 'send_electerm_terminal_command', {
      command: `echo "${marker}"`
    })
    assert.ok(sendData.result, 'send_command should succeed')

    const waitData = await callTool(sessionId, 63, 'wait_for_electerm_terminal_idle', {
      timeout: 20000,
      lines: 30
    })
    assert.ok(waitData.result, 'wait_for_terminal_idle should succeed')

    const waitResult = JSON.parse(waitData.result.content[0].text)
    assert.equal(waitResult.timedOut, false, 'Expected terminal to become idle before timeout')
    assert.ok(waitResult.elapsed >= 0, 'Expected non-negative elapsed time')
    assert.equal(typeof waitResult.lineCount, 'number')
    assert.equal(typeof waitResult.output, 'string')
    assert.ok(
      waitResult.output.includes(marker),
      `Expected echo output "${marker}" in terminal after idle wait`
    )
  })

  test('should correctly wait for a longer-running command to finish', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const openData = await callTool(sessionId, 64, 'open_electerm_local_terminal', {})
    assert.ok(openData.result, 'open_local_terminal should succeed')
    await new Promise(resolve => setTimeout(resolve, 3000))

    const marker = `SLOW_TEST_${Date.now()}`

    const sendData = await callTool(sessionId, 65, 'send_electerm_terminal_command', {
      command: `sleep 5 && echo "${marker}"`
    })
    assert.ok(sendData.result, 'send_command should succeed')

    const waitData = await callTool(sessionId, 66, 'wait_for_electerm_terminal_idle', {
      timeout: 30000,
      lines: 30
    })
    assert.ok(waitData.result, 'wait_for_terminal_idle should succeed')

    const waitResult = JSON.parse(waitData.result.content[0].text)
    assert.equal(waitResult.timedOut, false, 'Expected terminal to become idle before 30s timeout')
    assert.ok(waitResult.elapsed >= 5000, `Expected at least 5s elapsed but got ${waitResult.elapsed}ms`)
    assert.ok(
      waitResult.output.includes(marker),
      `Expected slow command output "${marker}" after idle wait`
    )
  })

  test('should return timedOut:true when terminal never becomes idle within timeout', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const openData = await callTool(sessionId, 67, 'open_electerm_local_terminal', {})
    assert.ok(openData.result, 'open_local_terminal should succeed')
    await new Promise(resolve => setTimeout(resolve, 3000))

    const sendData = await callTool(sessionId, 68, 'send_electerm_terminal_command', {
      command: 'ping -c 30 localhost'
    })
    assert.ok(sendData.result, 'send_command should succeed')

    const waitData = await callTool(sessionId, 69, 'wait_for_electerm_terminal_idle', {
      timeout: 8000,
      lines: 20,
      minWait: 500
    })
    assert.ok(waitData.result, 'wait_for_terminal_idle should succeed')

    const waitResult = JSON.parse(waitData.result.content[0].text)
    assert.equal(waitResult.timedOut, true, 'Expected timedOut:true when command keeps running')
    assert.ok(waitResult.elapsed >= 8000, `Expected at least 8s elapsed but got ${waitResult.elapsed}ms`)
    assert.equal(typeof waitResult.output, 'string', 'Should still return whatever output is in buffer')
  })
})
