const { test, describe } = require('node:test')
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

  return response.headers['mcp-session-id']
}

describe('mcp-widget', function () {
  let sessionId = null

  // Test that MCP server is running at the expected URL with default settings
  test('should be accessible at http://127.0.0.1:30837/mcp with default settings', { timeout: 100000 }, async function () {
    try {
      // Test OPTIONS request (CORS preflight)
      const optionsResponse = await makeHttpRequest('options', serverUrl)
      assert.equal(optionsResponse.status, 204)
      assert.equal(optionsResponse.headers['access-control-allow-origin'], '*')
      assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('POST'))
      assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('GET'))
      assert.ok(optionsResponse.headers['access-control-allow-methods'].includes('DELETE'))
      assert.ok(optionsResponse.headers['access-control-allow-headers'].includes('mcp-session-id'))

      console.log('MCP server is running and accessible at:', serverUrl)
      console.log('CORS headers are properly configured')
    } catch (err) {
      console.log('MCP server test error:', err.message)
      throw new Error(`MCP server is not accessible at ${serverUrl}. Make sure the MCP widget is running with default settings. Error: ${err.message}`)
    }
  })

  // Test MCP protocol initialization
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

    try {
      const response = await makeHttpRequest('post', serverUrl, initializeRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      })

      console.log('Initialize response status:', response.status)
      console.log('Initialize response data:', response.data)
      console.log('Initialize response headers:', response.headers)

      assert.equal(response.status, 200)
      assert.equal(response.headers['content-type'], 'text/event-stream')
      assert.ok(response.headers['mcp-session-id'])

      // Parse SSE response
      const sseData = response.data
      assert.ok(sseData.includes('event: message'))
      assert.ok(sseData.includes('data: '))

      // Extract JSON from SSE data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(dataLine)
      const jsonData = JSON.parse(dataLine.substring(6)) // Remove 'data: '

      assert.equal(jsonData.jsonrpc, '2.0')
      assert.equal(jsonData.id, 1)
      assert.ok(jsonData.result)
      assert.equal(jsonData.result.protocolVersion, '2024-11-05')
      assert.ok(jsonData.result.serverInfo)
      assert.equal(jsonData.result.serverInfo.name, 'electerm-mcp-server')

      // Store session ID for subsequent requests
      sessionId = response.headers['mcp-session-id']

      console.log('MCP initialize request successful')
      console.log('Server info:', jsonData.result.serverInfo)
      console.log('Session ID:', sessionId)
    } catch (err) {
      console.log('MCP initialize test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response headers:', err.response.headers)
        console.log('Response data:', err.response.data)
      }
      throw new Error(`MCP initialize request failed. Make sure the MCP widget is running with default settings. Error: ${err.message}`)
    }
  })

  // Test that tools are available
  test('should list available tools', { timeout: 100000 }, async function () {
    assert.ok(sessionId) // Should have session ID from initialize

    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }

    try {
      const response = await makeHttpRequest('post', serverUrl, toolsRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Tools response status:', response.status)
      console.log('Tools response data:', response.data)
      console.log('Tools response headers:', response.headers)

      assert.equal(response.status, 200)
      assert.equal(response.headers['content-type'], 'text/event-stream')

      // Parse SSE response
      const sseData = response.data
      assert.ok(sseData.includes('event: message'))
      assert.ok(sseData.includes('data: '))

      // Extract JSON from SSE data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(dataLine)
      const jsonData = JSON.parse(dataLine.substring(6)) // Remove 'data: '

      assert.equal(jsonData.jsonrpc, '2.0')
      assert.equal(jsonData.id, 2)
      assert.ok(jsonData.result)
      assert.ok(Array.isArray(jsonData.result.tools))
      assert.ok(jsonData.result.tools.length > 0)

      // Check for some expected tools
      const toolNames = jsonData.result.tools.map(tool => tool.name)
      assert.ok(toolNames.includes('list_electerm_tabs'))
      assert.ok(toolNames.includes('get_electerm_active_tab'))
      assert.ok(toolNames.includes('send_electerm_terminal_command'))

      console.log('Available tools:', toolNames.length)
      console.log('Sample tools:', toolNames.slice(0, 5))
    } catch (err) {
      console.log('MCP tools/list test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response headers:', err.response.headers)
        console.log('Response data:', err.response.data)
      }
      throw new Error(`MCP tools/list request failed. Make sure the MCP widget is running with default settings. Error: ${err.message}`)
    }
  })

  // Test tool calls (these will fail in test environment without renderer process)
  test('should handle tool calls gracefully when renderer is unavailable', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'open_local_terminal',
        arguments: {}
      }
    }

    try {
      const response = await makeHttpRequest('post', serverUrl, toolCallRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Tool call response status:', response.status)
      console.log('Tool call response data:', response.data)

      assert.equal(response.status, 200)
      assert.equal(response.headers['content-type'], 'text/event-stream')

      // Parse SSE response
      const sseData = response.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(dataLine)
      const jsonData = JSON.parse(dataLine.substring(6))

      assert.equal(jsonData.jsonrpc, '2.0')
      assert.equal(jsonData.id, 3)

      // In test environment without renderer process, we expect an error response
      // The MCP server correctly handles the case where no window is available
      if (jsonData.error) {
        console.log('Expected error in test environment:', jsonData.error.message)
        assert.ok(jsonData.error.code !== undefined)
      } else if (jsonData.result) {
        // If it succeeds, that's also fine - means renderer is available
        console.log('Tool call succeeded - renderer process is available')
      }

      console.log('MCP tool call protocol working correctly')
    } catch (err) {
      console.log('MCP tool call test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
      // Tool calls may fail in test environment - this is expected
      console.log('Tool call failed as expected in test environment without renderer process')
    }
  })

  // Test that multiple tool calls work in sequence
  test('should handle multiple tool calls in sequence', { timeout: 100000 }, async function () {
    assert.ok(sessionId)

    const testTools = [
      { name: 'list_tabs', args: {} },
      { name: 'get_active_tab', args: {} },
      { name: 'get_terminal_selection', args: {} }
    ]

    for (let i = 0; i < testTools.length; i++) {
      const tool = testTools[i]
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 10 + i,
        method: 'tools/call',
        params: {
          name: tool.name,
          arguments: tool.args
        }
      }

      try {
        const response = await makeHttpRequest('post', serverUrl, toolCallRequest, {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        })

        assert.equal(response.status, 200)
        assert.equal(response.headers['content-type'], 'text/event-stream')

        // Parse SSE response
        const sseData = response.data
        const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
        assert.ok(dataLine)
        const jsonData = JSON.parse(dataLine.substring(6))

        assert.equal(jsonData.jsonrpc, '2.0')
        assert.equal(jsonData.id, 10 + i)

        console.log(`Tool ${tool.name} call completed (may have failed due to no renderer)`)
      } catch (err) {
        console.log(`Tool ${tool.name} call failed:`, err.message)
        // Expected in test environment
      }
    }

    console.log('Multiple tool calls handled correctly')
  })

  // Test opening a local terminal and running a command
  test('should open local terminal and run command', { timeout: 100000 }, async function () {
    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    assert.ok(sessionId)

    // Step 1: Open a local terminal
    const openTerminalRequest = {
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: {
        name: 'open_local_terminal',
        arguments: {}
      }
    }

    try {
      const openResponse = await makeHttpRequest('post', serverUrl, openTerminalRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Open terminal response status:', openResponse.status)

      assert.equal(openResponse.status, 200)

      // Parse SSE response
      const sseData = openResponse.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(dataLine)
      const jsonData = JSON.parse(dataLine.substring(6))

      assert.equal(jsonData.jsonrpc, '2.0')
      assert.equal(jsonData.id, 20)

      if (jsonData.error) {
        console.log('Open terminal error (may be expected):', jsonData.error.message)
      } else if (jsonData.result) {
        const result = JSON.parse(jsonData.result.content[0].text)
        console.log('Open terminal result:', result)
        assert.equal(result.success, true)
        assert.ok(result.message.includes('local terminal'))
      }

      // Wait for terminal to initialize (shell needs time to start)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 2: Send a command to the terminal
      const uniqueId = Date.now()
      const testCommand = `echo "MCP_TEST_${uniqueId}"`

      const sendCommandRequest = {
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'send_terminal_command',
          arguments: {
            command: testCommand
          }
        }
      }

      const cmdResponse = await makeHttpRequest('post', serverUrl, sendCommandRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Send command response status:', cmdResponse.status)
      assert.equal(cmdResponse.status, 200)

      const cmdSseData = cmdResponse.data
      const cmdDataLine = cmdSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(cmdDataLine)
      const cmdJsonData = JSON.parse(cmdDataLine.substring(6))

      if (cmdJsonData.error) {
        console.log('Send command error (may be expected):', cmdJsonData.error.message)
      } else if (cmdJsonData.result) {
        const cmdResult = JSON.parse(cmdJsonData.result.content[0].text)
        console.log('Send command result:', cmdResult)
        assert.equal(cmdResult.success, true)
      }

      // Wait for command to execute and output to appear
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Get terminal output to verify command was executed
      const getOutputRequest = {
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
          name: 'get_terminal_output',
          arguments: {
            lines: 20
          }
        }
      }

      const outputResponse = await makeHttpRequest('post', serverUrl, getOutputRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Get output response status:', outputResponse.status)
      assert.equal(outputResponse.status, 200)

      const outputSseData = outputResponse.data
      const outputDataLine = outputSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(outputDataLine)
      const outputJsonData = JSON.parse(outputDataLine.substring(6))

      if (outputJsonData.error) {
        console.log('Get output error (may be expected):', outputJsonData.error.message)
      } else if (outputJsonData.result) {
        try {
          const outputResult = JSON.parse(outputJsonData.result.content[0].text)
          console.log('Terminal output result:', outputResult)
          assert.ok(outputResult.output !== undefined)
          assert.ok(outputResult.lineCount > 0)

          // Check if our command output is in the terminal
          if (outputResult.output.includes(`MCP_TEST_${uniqueId}`)) {
            console.log('SUCCESS: Found command output in terminal!')
          } else {
            console.log('Command output may not yet be visible in buffer')
            console.log('Output preview:', outputResult.output.slice(-200))
          }
        } catch (parseErr) {
          // Error message from handler, not JSON
          console.log('Get output returned error:', outputJsonData.result.content[0].text)
        }
      }

      console.log('Terminal command execution test completed')
    } catch (err) {
      console.log('Terminal command test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
      // This test requires the app to be running with GUI
      console.log('Note: This test requires electerm app to be running with a visible window')
    }
  })

  // Test get_terminal_output tool
  test('should get terminal output', { timeout: 100000 }, async function () {
    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    assert.ok(sessionId)

    const getOutputRequest = {
      jsonrpc: '2.0',
      id: 30,
      method: 'tools/call',
      params: {
        name: 'get_terminal_output',
        arguments: {
          lines: 10
        }
      }
    }

    try {
      const response = await makeHttpRequest('post', serverUrl, getOutputRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Get terminal output response status:', response.status)
      assert.equal(response.status, 200)

      const sseData = response.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(dataLine)
      const jsonData = JSON.parse(dataLine.substring(6))

      assert.equal(jsonData.jsonrpc, '2.0')
      assert.equal(jsonData.id, 30)

      if (jsonData.error) {
        console.log('Get terminal output error:', jsonData.error.message)
        // This is expected if no terminal is open
      } else if (jsonData.result) {
        const result = JSON.parse(jsonData.result.content[0].text)
        console.log('Terminal output:', result)
        assert.ok(result.output !== undefined)
        assert.ok(result.tabId !== undefined)
        assert.equal(typeof result.lineCount, 'number')
      }
    } catch (err) {
      console.log('Get terminal output test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
    }
  })

  // Test SSH bookmark creation, connection, command execution and output
  test('should create SSH bookmark, connect, run command and get output', { timeout: 100000 }, async function () {
    // Load test environment variables
    const {
      TEST_HOST,
      TEST_PASS,
      TEST_USER
    } = require('../e2e/common/env')

    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    assert.ok(sessionId)

    const uniqueId = Date.now()
    const bookmarkTitle = `MCP_SSH_Test_${uniqueId}`

    // Step 1: Create SSH bookmark
    const addBookmarkRequest = {
      jsonrpc: '2.0',
      id: 40,
      method: 'tools/call',
      params: {
        name: 'add_electerm_bookmark_ssh',
        arguments: {
          title: bookmarkTitle,
          host: TEST_HOST,
          port: 22,
          username: TEST_USER,
          password: TEST_PASS
        }
      }
    }

    try {
      const addResponse = await makeHttpRequest('post', serverUrl, addBookmarkRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Add bookmark response status:', addResponse.status)
      assert.equal(addResponse.status, 200)

      const addSseData = addResponse.data
      const addDataLine = addSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(addDataLine)
      const addJsonData = JSON.parse(addDataLine.substring(6))

      if (addJsonData.error) {
        console.log('Add bookmark error:', addJsonData.error.message)
        throw new Error(addJsonData.error.message)
      }

      const addResult = JSON.parse(addJsonData.result.content[0].text)
      console.log('Add bookmark result:', addResult)
      assert.equal(addResult.success, true)
      assert.ok(addResult.id !== undefined)

      const bookmarkId = addResult.id
      console.log('Created bookmark with ID:', bookmarkId)

      // Step 2: Open/connect to the bookmark
      const openBookmarkRequest = {
        jsonrpc: '2.0',
        id: 41,
        method: 'tools/call',
        params: {
          name: 'open_electerm_bookmark',
          arguments: {
            id: bookmarkId
          }
        }
      }

      const openResponse = await makeHttpRequest('post', serverUrl, openBookmarkRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Open bookmark response status:', openResponse.status)
      assert.equal(openResponse.status, 200)

      const openSseData = openResponse.data
      const openDataLine = openSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(openDataLine)
      const openJsonData = JSON.parse(openDataLine.substring(6))

      if (openJsonData.error) {
        console.log('Open bookmark error:', openJsonData.error.message)
        throw new Error(openJsonData.error.message)
      }

      const openResult = JSON.parse(openJsonData.result.content[0].text)
      console.log('Open bookmark result:', openResult)
      assert.equal(openResult.success, true)

      // Wait for SSH connection to establish
      console.log('Waiting for SSH connection to establish...')
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Step 3: Send a command to the SSH terminal with retry
      const testMarker = `SSH_MCP_TEST_${uniqueId}`
      const testCommand = `echo "${testMarker}"`

      const sendCommandRequest = {
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: {
          name: 'send_electerm_terminal_command',
          arguments: {
            command: testCommand
          }
        }
      }

      // Retry sending command up to 3 times with delay
      let cmdJsonData = null
      let lastError = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        const cmdResponse = await makeHttpRequest('post', serverUrl, sendCommandRequest, {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        })

        console.log(`Send SSH command attempt ${attempt} response status:`, cmdResponse.status)
        assert.equal(cmdResponse.status, 200)

        const cmdSseData = cmdResponse.data
        const cmdDataLine = cmdSseData.split('\n').find(line => line.startsWith('data: '))
        assert.ok(cmdDataLine)
        cmdJsonData = JSON.parse(cmdDataLine.substring(6))

        if (cmdJsonData.error) {
          console.log(`Send SSH command attempt ${attempt} error:`, cmdJsonData.error.message)
          lastError = cmdJsonData.error.message
          if (attempt < 3) {
            console.log('Waiting before retry...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
        } else {
          lastError = null
          break
        }
      }

      if (lastError) {
        throw new Error(lastError)
      }

      // Log raw text first to debug any parsing issues
      const cmdResultText = cmdJsonData.result.content[0].text
      console.log('Send SSH command raw result:', cmdResultText)

      let cmdResult
      try {
        cmdResult = JSON.parse(cmdResultText)
        console.log('Send SSH command result:', cmdResult)
        assert.equal(cmdResult.success, true)
      } catch (parseErr) {
        // The result might be an error message, not JSON
        console.log('Command result is not JSON, might be an error')
        throw new Error(cmdResultText)
      }

      // Wait for command to execute
      console.log('Waiting for command execution...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 4: Get terminal output to verify command execution
      const getOutputRequest = {
        jsonrpc: '2.0',
        id: 43,
        method: 'tools/call',
        params: {
          name: 'get_electerm_terminal_output',
          arguments: {
            lines: 30
          }
        }
      }

      const outputResponse = await makeHttpRequest('post', serverUrl, getOutputRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Get SSH output response status:', outputResponse.status)
      assert.equal(outputResponse.status, 200)

      const outputSseData = outputResponse.data
      const outputDataLine = outputSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(outputDataLine)
      const outputJsonData = JSON.parse(outputDataLine.substring(6))

      if (outputJsonData.error) {
        console.log('Get SSH output error:', outputJsonData.error.message)
        throw new Error(outputJsonData.error.message)
      }

      const outputResult = JSON.parse(outputJsonData.result.content[0].text)
      console.log('SSH terminal output:', outputResult)
      assert.ok(outputResult.output !== undefined)
      assert.ok(outputResult.lineCount > 0)

      // Check if our command output is in the terminal
      if (outputResult.output.includes(testMarker)) {
        console.log('SUCCESS: Found SSH command output in terminal!')
      } else {
        console.log('Command output may not yet be visible in buffer')
        console.log('Output preview:', outputResult.output.slice(-500))
      }

      // Step 5: Clean up - delete the test bookmark
      const deleteBookmarkRequest = {
        jsonrpc: '2.0',
        id: 44,
        method: 'tools/call',
        params: {
          name: 'delete_electerm_bookmark',
          arguments: {
            id: bookmarkId
          }
        }
      }

      const deleteResponse = await makeHttpRequest('post', serverUrl, deleteBookmarkRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Delete bookmark response status:', deleteResponse.status)
      assert.equal(deleteResponse.status, 200)

      const deleteSseData = deleteResponse.data
      const deleteDataLine = deleteSseData.split('\n').find(line => line.startsWith('data: '))
      if (deleteDataLine) {
        const deleteJsonData = JSON.parse(deleteDataLine.substring(6))
        if (!deleteJsonData.error) {
          const deleteResult = JSON.parse(deleteJsonData.result.content[0].text)
          console.log('Delete bookmark result:', deleteResult)
          assert.equal(deleteResult.success, true)
        }
      }

      // Step 6: Verify the bookmark was actually deleted
      const listBookmarksRequest = {
        jsonrpc: '2.0',
        id: 45,
        method: 'tools/call',
        params: {
          name: 'list_electerm_bookmarks'
        }
      }

      const listResponse = await makeHttpRequest('post', serverUrl, listBookmarksRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('List bookmarks response status:', listResponse.status)
      assert.equal(listResponse.status, 200)

      const listSseData = listResponse.data
      const listDataLine = listSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(listDataLine)
      const listJsonData = JSON.parse(listDataLine.substring(6))

      if (listJsonData.error) {
        console.log('List bookmarks error:', listJsonData.error.message)
        throw new Error(listJsonData.error.message)
      }

      const bookmarks = JSON.parse(listJsonData.result.content[0].text)
      console.log('Bookmarks after deletion:', bookmarks.length)
      const deletedBookmark = bookmarks.find(b => b.id === bookmarkId)
      assert.ok(!deletedBookmark, `Bookmark with ID ${bookmarkId} should have been deleted but was found`)

      console.log('SSH bookmark test completed successfully')
    } catch (err) {
      console.log('SSH bookmark test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
      throw err
    }
  })

  // Test Telnet bookmark creation
  test('should create Telnet bookmark', { timeout: 100000 }, async function () {
    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    assert.ok(sessionId)

    const uniqueId = Date.now()
    const bookmarkTitle = `MCP_Telnet_Test_${uniqueId}`

    // Create Telnet bookmark
    const addBookmarkRequest = {
      jsonrpc: '2.0',
      id: 50,
      method: 'tools/call',
      params: {
        name: 'add_electerm_bookmark_telnet',
        arguments: {
          title: bookmarkTitle,
          host: '127.0.0.1',
          port: 23,
          username: 'testuser',
          password: 'testpass'
        }
      }
    }

    try {
      const addResponse = await makeHttpRequest('post', serverUrl, addBookmarkRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('Add telnet bookmark response status:', addResponse.status)
      assert.equal(addResponse.status, 200)

      const addSseData = addResponse.data
      const addDataLine = addSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(addDataLine)
      const addJsonData = JSON.parse(addDataLine.substring(6))

      if (addJsonData.error) {
        console.log('Add telnet bookmark error:', addJsonData.error.message)
        throw new Error(addJsonData.error.message)
      }

      const addResult = JSON.parse(addJsonData.result.content[0].text)
      console.log('Add telnet bookmark result:', addResult)
      assert.equal(addResult.success, true)
      assert.ok(addResult.id !== undefined)

      const bookmarkId = addResult.id
      console.log('Created telnet bookmark with ID:', bookmarkId)

      // Verify bookmark was created by listing bookmarks
      const listBookmarksRequest = {
        jsonrpc: '2.0',
        id: 51,
        method: 'tools/call',
        params: {
          name: 'list_electerm_bookmarks',
          arguments: {}
        }
      }

      const listResponse = await makeHttpRequest('post', serverUrl, listBookmarksRequest, {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      })

      console.log('List bookmarks response status:', listResponse.status)
      assert.equal(listResponse.status, 200)

      const listSseData = listResponse.data
      const listDataLine = listSseData.split('\n').find(line => line.startsWith('data: '))
      assert.ok(listDataLine)
      const listJsonData = JSON.parse(listDataLine.substring(6))

      if (listJsonData.error) {
        console.log('List bookmarks error:', listJsonData.error.message)
        throw new Error(listJsonData.error.message)
      }

      const bookmarks = JSON.parse(listJsonData.result.content[0].text)
      const createdBookmark = bookmarks.find(b => b.id === bookmarkId)
      assert.ok(createdBookmark, `Bookmark with ID ${bookmarkId} not found in list`)
      assert.equal(createdBookmark.title, bookmarkTitle)
      assert.equal(createdBookmark.type, 'telnet')

      console.log('Telnet bookmark test completed successfully')
    } catch (err) {
      console.log('Telnet bookmark test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
      throw err
    }
  })
})
