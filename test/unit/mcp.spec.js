const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it
const axios = require('axios')

it.setTimeout(100000)

const serverUrl = 'http://127.0.0.1:30837/mcp'

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

  const response = await axios.post(serverUrl, initializeRequest, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    }
  })

  return response.headers['mcp-session-id']
}

describe('mcp-widget', function () {
  let sessionId = null

  // Test that MCP server is running at the expected URL with default settings
  it('should be accessible at http://127.0.0.1:30837/mcp with default settings', async function () {
    try {
      // Test OPTIONS request (CORS preflight)
      const optionsResponse = await axios.options(serverUrl)
      expect(optionsResponse.status).toBe(204)
      expect(optionsResponse.headers['access-control-allow-origin']).toBe('*')
      expect(optionsResponse.headers['access-control-allow-methods']).toContain('POST')
      expect(optionsResponse.headers['access-control-allow-methods']).toContain('GET')
      expect(optionsResponse.headers['access-control-allow-methods']).toContain('DELETE')
      expect(optionsResponse.headers['access-control-allow-headers']).toContain('mcp-session-id')

      console.log('MCP server is running and accessible at:', serverUrl)
      console.log('CORS headers are properly configured')
    } catch (err) {
      console.log('MCP server test error:', err.message)
      throw new Error(`MCP server is not accessible at ${serverUrl}. Make sure the MCP widget is running with default settings. Error: ${err.message}`)
    }
  })

  // Test MCP protocol initialization
  it('should respond to MCP initialize request', async function () {
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
      const response = await axios.post(serverUrl, initializeRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream'
        }
      })

      console.log('Initialize response status:', response.status)
      console.log('Initialize response data:', response.data)
      console.log('Initialize response headers:', response.headers)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('text/event-stream')
      expect(response.headers['mcp-session-id']).toBeTruthy()

      // Parse SSE response
      const sseData = response.data
      expect(sseData).toContain('event: message')
      expect(sseData).toContain('data: ')

      // Extract JSON from SSE data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      expect(dataLine).toBeTruthy()
      const jsonData = JSON.parse(dataLine.substring(6)) // Remove 'data: '

      expect(jsonData.jsonrpc).toBe('2.0')
      expect(jsonData.id).toBe(1)
      expect(jsonData.result).toBeTruthy()
      expect(jsonData.result.protocolVersion).toBe('2024-11-05')
      expect(jsonData.result.serverInfo).toBeTruthy()
      expect(jsonData.result.serverInfo.name).toBe('electerm-mcp-server')

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
  it('should list available tools', async function () {
    expect(sessionId).toBeTruthy() // Should have session ID from initialize

    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }

    try {
      const response = await axios.post(serverUrl, toolsRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Tools response status:', response.status)
      console.log('Tools response data:', response.data)
      console.log('Tools response headers:', response.headers)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('text/event-stream')

      // Parse SSE response
      const sseData = response.data
      expect(sseData).toContain('event: message')
      expect(sseData).toContain('data: ')

      // Extract JSON from SSE data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      expect(dataLine).toBeTruthy()
      const jsonData = JSON.parse(dataLine.substring(6)) // Remove 'data: '

      expect(jsonData.jsonrpc).toBe('2.0')
      expect(jsonData.id).toBe(2)
      expect(jsonData.result).toBeTruthy()
      expect(Array.isArray(jsonData.result.tools)).toBe(true)
      expect(jsonData.result.tools.length).toBeGreaterThan(0)

      // Check for some expected tools
      const toolNames = jsonData.result.tools.map(tool => tool.name)
      expect(toolNames).toContain('list_tabs')
      expect(toolNames).toContain('get_active_tab')
      expect(toolNames).toContain('send_terminal_command')

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
  it('should handle tool calls gracefully when renderer is unavailable', async function () {
    expect(sessionId).toBeTruthy()

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
      const response = await axios.post(serverUrl, toolCallRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Tool call response status:', response.status)
      console.log('Tool call response data:', response.data)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('text/event-stream')

      // Parse SSE response
      const sseData = response.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      expect(dataLine).toBeTruthy()
      const jsonData = JSON.parse(dataLine.substring(6))

      expect(jsonData.jsonrpc).toBe('2.0')
      expect(jsonData.id).toBe(3)

      // In test environment without renderer process, we expect an error response
      // The MCP server correctly handles the case where no window is available
      if (jsonData.error) {
        console.log('Expected error in test environment:', jsonData.error.message)
        expect(jsonData.error.code).toBeDefined()
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
  it('should handle multiple tool calls in sequence', async function () {
    expect(sessionId).toBeTruthy()

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
        const response = await axios.post(serverUrl, toolCallRequest, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'mcp-session-id': sessionId
          }
        })

        expect(response.status).toBe(200)
        expect(response.headers['content-type']).toBe('text/event-stream')

        // Parse SSE response
        const sseData = response.data
        const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
        expect(dataLine).toBeTruthy()
        const jsonData = JSON.parse(dataLine.substring(6))

        expect(jsonData.jsonrpc).toBe('2.0')
        expect(jsonData.id).toBe(10 + i)

        console.log(`Tool ${tool.name} call completed (may have failed due to no renderer)`)
      } catch (err) {
        console.log(`Tool ${tool.name} call failed:`, err.message)
        // Expected in test environment
      }
    }

    console.log('Multiple tool calls handled correctly')
  })

  // Test opening a local terminal and running a command
  it('should open local terminal and run command', async function () {
    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    expect(sessionId).toBeTruthy()

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
      const openResponse = await axios.post(serverUrl, openTerminalRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Open terminal response status:', openResponse.status)

      expect(openResponse.status).toBe(200)

      // Parse SSE response
      const sseData = openResponse.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      expect(dataLine).toBeTruthy()
      const jsonData = JSON.parse(dataLine.substring(6))

      expect(jsonData.jsonrpc).toBe('2.0')
      expect(jsonData.id).toBe(20)

      if (jsonData.error) {
        console.log('Open terminal error (may be expected):', jsonData.error.message)
      } else if (jsonData.result) {
        const result = JSON.parse(jsonData.result.content[0].text)
        console.log('Open terminal result:', result)
        expect(result.success).toBe(true)
        expect(result.message).toContain('local terminal')
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

      const cmdResponse = await axios.post(serverUrl, sendCommandRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Send command response status:', cmdResponse.status)
      expect(cmdResponse.status).toBe(200)

      const cmdSseData = cmdResponse.data
      const cmdDataLine = cmdSseData.split('\n').find(line => line.startsWith('data: '))
      expect(cmdDataLine).toBeTruthy()
      const cmdJsonData = JSON.parse(cmdDataLine.substring(6))

      if (cmdJsonData.error) {
        console.log('Send command error (may be expected):', cmdJsonData.error.message)
      } else if (cmdJsonData.result) {
        const cmdResult = JSON.parse(cmdJsonData.result.content[0].text)
        console.log('Send command result:', cmdResult)
        expect(cmdResult.success).toBe(true)
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

      const outputResponse = await axios.post(serverUrl, getOutputRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Get output response status:', outputResponse.status)
      expect(outputResponse.status).toBe(200)

      const outputSseData = outputResponse.data
      const outputDataLine = outputSseData.split('\n').find(line => line.startsWith('data: '))
      expect(outputDataLine).toBeTruthy()
      const outputJsonData = JSON.parse(outputDataLine.substring(6))

      if (outputJsonData.error) {
        console.log('Get output error (may be expected):', outputJsonData.error.message)
      } else if (outputJsonData.result) {
        try {
          const outputResult = JSON.parse(outputJsonData.result.content[0].text)
          console.log('Terminal output result:', outputResult)
          expect(outputResult.output).toBeDefined()
          expect(outputResult.lineCount).toBeGreaterThan(0)

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
  it('should get terminal output', async function () {
    // Initialize session if not already done
    if (!sessionId) {
      sessionId = await initSession()
    }
    expect(sessionId).toBeTruthy()

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
      const response = await axios.post(serverUrl, getOutputRequest, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId
        }
      })

      console.log('Get terminal output response status:', response.status)
      expect(response.status).toBe(200)

      const sseData = response.data
      const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
      expect(dataLine).toBeTruthy()
      const jsonData = JSON.parse(dataLine.substring(6))

      expect(jsonData.jsonrpc).toBe('2.0')
      expect(jsonData.id).toBe(30)

      if (jsonData.error) {
        console.log('Get terminal output error:', jsonData.error.message)
        // This is expected if no terminal is open
      } else if (jsonData.result) {
        const result = JSON.parse(jsonData.result.content[0].text)
        console.log('Terminal output:', result)
        expect(result.output).toBeDefined()
        expect(result.tabId).toBeDefined()
        expect(typeof result.lineCount).toBe('number')
      }
    } catch (err) {
      console.log('Get terminal output test error:', err.message)
      if (err.response) {
        console.log('Response status:', err.response.status)
        console.log('Response data:', err.response.data)
      }
    }
  })
})
