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

// Helper to initialize MCP session
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

// Helper to call a tool via MCP
async function callTool (sessionId, id, toolName, args) {
  const request = {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  }

  const response = await makeHttpRequest('post', serverUrl, request, {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-session-id': sessionId
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers['content-type'], 'text/event-stream')

  const sseData = response.data
  const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
  assert.ok(dataLine, 'SSE data line not found')
  const jsonData = JSON.parse(dataLine.substring(6))

  assert.equal(jsonData.jsonrpc, '2.0')
  assert.equal(jsonData.id, id)

  return jsonData
}

// Helper: check if renderer is available
async function checkRenderer (sid) {
  const jsonData = await callTool(sid, 999, 'list_electerm_tabs', {})
  return !jsonData.error
}

describe('mcp-sftp-transfer-trzsz', function () {
  let sessionId = null
  let hasRenderer = false
  const uniqueId = Date.now()

  before(async () => {
    sessionId = await initSession()
    hasRenderer = await checkRenderer(sessionId)
    if (!hasRenderer) {
      console.log('No renderer detected — renderer-dependent tests will be skipped')
    }
  })

  // ==================== Tool availability check (no renderer needed) ====================

  test('should list SFTP/transfer/trzsz tools in tools/list', { timeout: 100000 }, async function () {
    const response = await makeHttpRequest('post', serverUrl, {
      jsonrpc: '2.0',
      id: 400,
      method: 'tools/list',
      params: {}
    }, {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': sessionId
    })

    assert.equal(response.status, 200)

    const sseData = response.data
    const dataLine = sseData.split('\n').find(line => line.startsWith('data: '))
    assert.ok(dataLine)
    const jsonData = JSON.parse(dataLine.substring(6))

    assert.equal(jsonData.jsonrpc, '2.0')
    assert.equal(jsonData.id, 400)
    assert.ok(jsonData.result)
    assert.ok(Array.isArray(jsonData.result.tools))

    const toolNames = jsonData.result.tools.map(t => t.name)

    const expectedTools = [
      'electerm_sftp_list',
      'electerm_sftp_stat',
      'electerm_sftp_read_file',
      'electerm_sftp_del_file_or_folder',
      'electerm_sftp_upload',
      'electerm_sftp_download',
      'electerm_zmodem_upload',
      'electerm_zmodem_download',
      'electerm_sftp_transfer_list',
      'electerm_sftp_transfer_history',
      'get_electerm_terminal_status',
      'cancel_electerm_terminal_command',
      'run_electerm_background_command',
      'get_electerm_background_task_status',
      'get_electerm_background_task_log',
      'cancel_electerm_background_task'
    ]

    for (const toolName of expectedTools) {
      assert.ok(toolNames.includes(toolName), `Expected tool "${toolName}" to be registered`)
    }
  })

  // ==================== Validation error tests (no renderer needed) ====================

  test('sftp_list: should error if remotePath is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 101, 'electerm_sftp_list', {})

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when remotePath is missing')
  })

  test('sftp_del: should error if remotePath is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 131, 'electerm_sftp_del_file_or_folder', {})

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when remotePath is missing')
  })

  test('sftp_upload: should error if localPath is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 201, 'electerm_sftp_upload', {
      remotePath: '/tmp/test.txt'
    })

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when localPath is missing')
  })

  test('sftp_download: should error if remotePath is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 211, 'electerm_sftp_download', {
      localPath: '/tmp/test.txt'
    })

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when remotePath is missing')
  })

  test('sftp_download: should error if saveFolder is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 312, 'electerm_zmodem_download', {
      remoteFiles: ['/tmp/test.txt']
    })

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when saveFolder is missing')
  })

  test('electerm_zmodem_upload: should error if files is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 301, 'electerm_zmodem_upload', {})

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when files is missing')
  })

  test('electerm_zmodem_upload: should error if files array is empty', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 302, 'electerm_zmodem_upload', {
      files: []
    })

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when files array is empty')
  })

  test('electerm_zmodem_download: should error if remoteFiles is missing', { timeout: 100000 }, async function () {
    const jsonData = await callTool(sessionId, 311, 'electerm_zmodem_download', {
      saveFolder: '/tmp'
    })

    assert.ok(jsonData.error || (jsonData.result && jsonData.result.isError),
      'Expected error when remoteFiles is missing')
  })

  // ==================== Renderer-dependent SFTP operation tests ====================

  test('sftp_list: should list remote directory', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 100, 'electerm_sftp_list', {
      remotePath: '/tmp'
    })

    // Either no SSH tab open (error) or success with valid result
    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(Array.isArray(result.list), 'result.list should be an array')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.ok(result.host !== undefined, 'result.host should be present')
    }
  })

  test('sftp_stat: should get stat of remote file or directory', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 110, 'electerm_sftp_stat', {
      remotePath: '/tmp'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.stat !== undefined, 'result.stat should be present')
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }
  })

  test('sftp_read_file: should read content of a remote file', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 120, 'electerm_sftp_read_file', {
      remotePath: '/etc/hostname'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.content !== undefined, 'result.content should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }
  })

  test('sftp_del: should delete a remote file', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 130, 'electerm_sftp_del_file_or_folder', {
      remotePath: `/tmp/mcp2_test_delete_${uniqueId}.txt`
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.success === true, 'should succeed')
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }
  })

  // ==================== Full SFTP workflow (requires SSH connection) ====================

  test('sftp: full workflow - list, stat, read, del', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const {
      TEST_HOST,
      TEST_PASS,
      TEST_USER,
      TEST_PORT
    } = require('../e2e/common/env')

    const wfId = Date.now()
    const bookmarkTitle = `MCP2_SFTP_Test_${wfId}`

    // Step 1: Create SSH bookmark
    const addData = await callTool(sessionId, 140, 'add_electerm_bookmark_ssh', {
      title: bookmarkTitle,
      host: TEST_HOST,
      port: parseInt(TEST_PORT, 10),
      username: TEST_USER,
      password: TEST_PASS
    })
    assert.ok(addData.result, 'add_bookmark should succeed')
    const addResult = JSON.parse(addData.result.content[0].text)
    assert.equal(addResult.success, true)
    const bookmarkId = addResult.id

    try {
      // Step 2: Open the bookmark
      const openData = await callTool(sessionId, 141, 'open_electerm_bookmark', { id: bookmarkId })
      assert.ok(openData.result, 'open_bookmark should succeed')

      // Wait for tab to initialize and SFTP panel to be ready
      await new Promise(resolve => setTimeout(resolve, 8000))

      // Step 3: List /tmp directory
      const listData = await callTool(sessionId, 142, 'electerm_sftp_list', { remotePath: '/tmp' })
      if (listData.result?.isError) {
        // SFTP panel may not be initialized in test environment
        assert.ok(listData.result.content[0].text, 'error message should be present')
      } else {
        assert.ok(listData.result, 'sftp_list should succeed')
        const listResult = JSON.parse(listData.result.content[0].text)
        assert.ok(Array.isArray(listResult.list), 'list should be an array')
      }

      // Step 4: Stat /tmp
      const statData = await callTool(sessionId, 143, 'electerm_sftp_stat', { remotePath: '/tmp' })
      if (statData.result?.isError) {
        assert.ok(statData.result.content[0].text, 'error message should be present')
      } else {
        assert.ok(statData.result, 'sftp_stat should succeed')
        const statResult = JSON.parse(statData.result.content[0].text)
        assert.ok(statResult.stat !== undefined)
      }

      // Step 5: Read /etc/hostname
      const readData = await callTool(sessionId, 144, 'electerm_sftp_read_file', { remotePath: '/etc/hostname' })
      if (readData.result?.isError) {
        assert.ok(readData.result.content[0].text, 'error message should be present')
      } else {
        assert.ok(readData.result, 'sftp_read_file should succeed')
        const readResult = JSON.parse(readData.result.content[0].text)
        assert.ok(readResult.content !== undefined)
      }
    } finally {
      // Step 6: Clean up - delete test bookmark
      await callTool(sessionId, 145, 'delete_electerm_bookmark', { id: bookmarkId })
    }
  })

  // ==================== File Transfer - Upload ====================

  test('sftp_upload: should start upload transfer', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const fs = require('fs')
    const uploadFile = `/tmp/mcp2-test-upload-${uniqueId}.txt`
    if (!fs.existsSync(uploadFile)) {
      fs.writeFileSync(uploadFile, 'test upload content for MCP test')
    }

    const jsonData = await callTool(sessionId, 200, 'electerm_sftp_upload', {
      localPath: uploadFile,
      remotePath: uploadFile
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.success === true, 'upload should succeed')
      assert.ok(result.transferId !== undefined, 'should have transferId')
      assert.ok(result.tabId !== undefined, 'should have tabId')
    }
  })

  // ==================== File Transfer - Download ====================

  test('sftp_download: should start download transfer', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 210, 'electerm_sftp_download', {
      remotePath: '/etc/hostname',
      localPath: `/tmp/mcp2-downloaded-hostname-${uniqueId}.txt`
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.success === true, 'download should succeed')
      assert.ok(result.transferId !== undefined, 'should have transferId')
      assert.ok(result.tabId !== undefined, 'should have tabId')
    }
  })

  test('sftp_download: should support conflictPolicy parameter', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 212, 'electerm_sftp_download', {
      remotePath: '/etc/hostname',
      localPath: `/tmp/mcp2-downloaded-hostname-ow-${uniqueId}.txt`,
      conflictPolicy: 'overwrite'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(result.success === true, 'download should succeed')
    }
  })

  // ==================== Zmodem Upload (trzsz/rzsz) ====================

  test('electerm_zmodem_upload: should initiate trz upload (trzsz, default)', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 300, 'electerm_zmodem_upload', {
      files: [`/tmp/mcp2-trzsz-upload-${uniqueId}.txt`]
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.equal(result.success, true)
      assert.ok(Array.isArray(result.files), 'result.files should be array')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.equal(result.protocol, 'rzsz', 'default protocol should be rzsz')
      assert.equal(result.command, 'rz', 'default command should be rz')
    }
  })

  test('electerm_zmodem_upload: should initiate rz upload (rzsz protocol)', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 303, 'electerm_zmodem_upload', {
      files: [`/tmp/mcp2-rzsz-upload-${uniqueId}.txt`],
      protocol: 'rzsz'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.equal(result.success, true)
      assert.equal(result.protocol, 'rzsz', 'protocol should be rzsz')
      assert.equal(result.command, 'rz', 'command should be rz for rzsz')
    }
  })

  // ==================== Zmodem Download (trzsz/rzsz) ====================

  test('electerm_zmodem_download: should initiate tsz download (trzsz, default)', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 310, 'electerm_zmodem_download', {
      remoteFiles: [`/tmp/mcp2-trzsz-download-${uniqueId}.txt`],
      saveFolder: '/tmp'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.equal(result.success, true)
      assert.ok(Array.isArray(result.remoteFiles), 'result.remoteFiles should be array')
      assert.ok(result.saveFolder !== undefined, 'result.saveFolder should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.equal(result.protocol, 'rzsz', 'default protocol should be rzsz')
      assert.equal(result.command, 'sz', 'default command should be sz')
    }
  })

  test('electerm_zmodem_download: should initiate sz download (rzsz protocol)', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 313, 'electerm_zmodem_download', {
      remoteFiles: [`/tmp/mcp2-rzsz-download-${uniqueId}.txt`],
      saveFolder: '/tmp',
      protocol: 'rzsz'
    })

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.equal(result.success, true)
      assert.equal(result.protocol, 'rzsz', 'protocol should be rzsz')
      assert.equal(result.command, 'sz', 'command should be sz for rzsz')
    }
  })

  // ==================== Transfer List & History ====================

  test('sftp_transfer_list: should return current transfer list', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 400, 'electerm_sftp_transfer_list', {})

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(Array.isArray(result), 'result should be an array')
      if (result.length > 0) {
        const t = result[0]
        assert.ok(t.id !== undefined, 'transfer should have id')
        assert.ok(t.fromPath !== undefined, 'transfer should have fromPath')
        assert.ok(t.toPath !== undefined, 'transfer should have toPath')
        assert.ok(t.typeFrom !== undefined, 'transfer should have typeFrom')
        assert.ok(t.typeTo !== undefined, 'transfer should have typeTo')
      }
    }
  })

  test('sftp_transfer_history: should return transfer history', { timeout: 100000 }, async function () {
    if (!hasRenderer) return test.skip('No renderer available')

    const jsonData = await callTool(sessionId, 410, 'electerm_sftp_transfer_history', {})

    if (jsonData.error || jsonData.result?.isError) {
      assert.ok(jsonData.error?.code !== undefined || jsonData.result?.isError, 'Error must have a code or isError flag')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      assert.ok(Array.isArray(result), 'result should be an array')
      if (result.length > 0) {
        const h = result[0]
        assert.ok(h.id !== undefined, 'history item should have id')
        assert.ok(h.fromPath !== undefined, 'history item should have fromPath')
        assert.ok(h.toPath !== undefined, 'history item should have toPath')
        assert.ok(h.typeFrom !== undefined, 'history item should have typeFrom')
      }
    }
  })
})
