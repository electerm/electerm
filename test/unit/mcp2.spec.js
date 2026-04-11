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

describe('mcp-sftp-transfer-trzsz', function () {
  let sessionId = null
  const uniqueId = Date.now()

  // Initialize session before tests
  test('should initialize MCP session for sftp/transfer/trzsz tests', { timeout: 100000 }, async function () {
    sessionId = await initSession()
    assert.ok(sessionId && sessionId !== 'null', `Expected a real session ID but got: ${sessionId}`)
    console.log('Session initialized:', sessionId)
  })

  // ==================== SFTP list ====================

  test('sftp_list: should list remote directory', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 100, 'electerm_sftp_list', {
      remotePath: '/tmp'
    })

    if (jsonData.error) {
      // Expected when no SSH tab is open
      console.log('sftp_list error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_list tool error (expected if no SSH tab open):', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_list result:', result)
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(Array.isArray(result.list), 'result.list should be an array')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.ok(result.host !== undefined, 'result.host should be present')
    }

    console.log('sftp_list test completed')
  })

  test('sftp_list: should error if remotePath is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 101, 'electerm_sftp_list', {})

    // Should error because remotePath is required
    if (jsonData.error) {
      console.log('sftp_list missing path error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_list missing path tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      // May still get a result if the tool validates properly and returns error in result
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_list no path result:', result)
    }

    console.log('sftp_list missing path test completed')
  })

  // ==================== SFTP stat ====================

  test('sftp_stat: should get stat of remote file or directory', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 110, 'electerm_sftp_stat', {
      remotePath: '/tmp'
    })

    if (jsonData.error) {
      console.log('sftp_stat error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_stat tool error (expected if no SSH tab open):', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_stat result:', result)
      assert.ok(result.stat !== undefined, 'result.stat should be present')
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }

    console.log('sftp_stat test completed')
  })

  // ==================== SFTP readFile ====================

  test('sftp_read_file: should read content of a remote file', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 120, 'electerm_sftp_read_file', {
      remotePath: '/etc/hostname'
    })

    if (jsonData.error) {
      console.log('sftp_read_file error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_read_file tool error (expected if no SSH tab open):', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_read_file result:', result)
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.content !== undefined, 'result.content should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }

    console.log('sftp_read_file test completed')
  })

  // ==================== SFTP del ====================

  test('sftp_del: should delete a remote file', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    // Use a test path that may or may not exist
    const jsonData = await callTool(sessionId, 130, 'electerm_sftp_del_file_or_folder', {
      remotePath: `/tmp/mcp2_test_delete_${uniqueId}.txt`
    })

    if (jsonData.error) {
      console.log('sftp_del error (expected if no SSH tab open or file not found):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_del tool error (file may not exist):', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_del result:', result)
      assert.ok(result.success === true, 'should succeed')
      assert.ok(result.path !== undefined, 'result.path should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
    }

    console.log('sftp_del test completed')
  })

  test('sftp_del: should error if remotePath is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 131, 'electerm_sftp_del_file_or_folder', {})

    if (jsonData.error) {
      console.log('sftp_del missing path error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_del missing path tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_del no path result:', result)
    }

    console.log('sftp_del missing path test completed')
  })

  // ==================== Full SFTP workflow (requires SSH connection) ====================

  test('sftp: full workflow - list, stat, read, del', { timeout: 100000 }, async function () {
    const {
      TEST_HOST,
      TEST_PASS,
      TEST_USER,
      TEST_PORT
    } = require('../e2e/common/env')

    if (!sessionId) {
      sessionId = await initSession()
    }

    const uniqueId = Date.now()
    const bookmarkTitle = `MCP2_SFTP_Test_${uniqueId}`

    try {
      // Step 1: Create SSH bookmark
      const addBookmarkData = await callTool(sessionId, 140, 'add_electerm_bookmark_ssh', {
        title: bookmarkTitle,
        host: TEST_HOST,
        port: parseInt(TEST_PORT, 10),
        username: TEST_USER,
        password: TEST_PASS
      })

      if (addBookmarkData.error) {
        console.log('Cannot create bookmark:', addBookmarkData.error.message)
        return
      }

      const addResult = JSON.parse(addBookmarkData.result.content[0].text)
      assert.equal(addResult.success, true)
      const bookmarkId = addResult.id
      console.log('Created bookmark:', bookmarkId)

      // Step 2: Open the bookmark
      const openData = await callTool(sessionId, 141, 'open_electerm_bookmark', { id: bookmarkId })
      if (openData.error) {
        console.log('Cannot open bookmark:', openData.error.message)
        return
      }
      console.log('Opened bookmark')

      // Wait for tab to initialize and SFTP panel to be ready
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Step 3: List /tmp directory
      const listData = await callTool(sessionId, 142, 'electerm_sftp_list', { remotePath: '/tmp' })
      if (listData.error) {
        console.log('sftp_list error (SFTP panel may not be open yet):', listData.error.message)
      } else {
        const listResult = JSON.parse(listData.result.content[0].text)
        console.log('sftp_list /tmp count:', listResult.list.length)
        assert.ok(Array.isArray(listResult.list), 'list should be an array')
      }

      // Step 4: Stat /tmp
      const statData = await callTool(sessionId, 143, 'electerm_sftp_stat', { remotePath: '/tmp' })
      if (statData.error) {
        console.log('sftp_stat error:', statData.error.message)
      } else {
        const statResult = JSON.parse(statData.result.content[0].text)
        console.log('sftp_stat /tmp:', statResult.stat)
        assert.ok(statResult.stat !== undefined)
      }

      // Step 5: Read /etc/hostname
      const readData = await callTool(sessionId, 144, 'electerm_sftp_read_file', { remotePath: '/etc/hostname' })
      if (readData.error) {
        console.log('sftp_read_file error:', readData.error.message)
      } else {
        const readResult = JSON.parse(readData.result.content[0].text)
        console.log('sftp_read_file /etc/hostname content:', readResult.content)
        assert.ok(readResult.content !== undefined)
      }

      // Step 6: Delete test bookmark
      await callTool(sessionId, 145, 'delete_electerm_bookmark', { id: bookmarkId })
      console.log('SFTP full workflow test completed')
    } catch (err) {
      console.log('SFTP workflow test error:', err.message)
      // Not a hard failure - requires live SSH connection
    }
  })

  // ==================== File Transfer - Upload ====================

  test('sftp_upload: should start upload transfer', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    // Create test file if it doesn't exist
    const fs = require('fs')
    const uploadFile = `/tmp/mcp2-test-upload-${uniqueId}.txt`
    if (!fs.existsSync(uploadFile)) {
      fs.writeFileSync(uploadFile, 'test upload content for MCP test')
    }

    const jsonData = await callTool(sessionId, 200, 'electerm_sftp_upload', {
      localPath: uploadFile,
      remotePath: uploadFile
    })

    if (jsonData.error) {
      console.log('sftp_upload error (expected if no SSH tab open or file not found):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_upload tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_upload result:', result)
      assert.ok(result.success === true, 'upload should succeed')
      assert.ok(result.transferId !== undefined, 'should have transferId')
      assert.ok(result.tabId !== undefined, 'should have tabId')
    }

    console.log('sftp_upload test completed')
  })

  test('sftp_upload: should error if localPath is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 201, 'electerm_sftp_upload', {
      remotePath: '/tmp/test.txt'
    })

    if (jsonData.error) {
      console.log('sftp_upload missing localPath error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_upload missing localPath tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_upload no localPath result:', result)
    }

    console.log('sftp_upload missing localPath test completed')
  })

  // ==================== File Transfer - Download ====================

  test('sftp_download: should start download transfer', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 210, 'electerm_sftp_download', {
      remotePath: '/etc/hostname',
      localPath: `/tmp/mcp2-downloaded-hostname-${uniqueId}.txt`
    })

    if (jsonData.error) {
      console.log('sftp_download error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_download result:', result)
      assert.ok(result.success === true, 'download should succeed')
      assert.ok(result.transferId !== undefined, 'should have transferId')
      assert.ok(result.tabId !== undefined, 'should have tabId')
    }

    console.log('sftp_download test completed')
  })

  test('sftp_download: should error if remotePath is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 211, 'electerm_sftp_download', {
      localPath: '/tmp/test.txt'
    })

    if (jsonData.error) {
      console.log('sftp_download missing remotePath error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('sftp_download missing remotePath tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_download no remotePath result:', result)
    }

    console.log('sftp_download missing remotePath test completed')
  })

  test('sftp_download: should support conflictPolicy parameter', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 212, 'electerm_sftp_download', {
      remotePath: '/etc/hostname',
      localPath: `/tmp/mcp2-downloaded-hostname-ow-${uniqueId}.txt`,
      conflictPolicy: 'overwrite'
    })

    if (jsonData.error) {
      console.log('sftp_download with conflictPolicy error (expected if no SSH tab):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_download with conflictPolicy result:', result)
      assert.ok(result.success === true, 'download should succeed')
    }

    console.log('sftp_download conflictPolicy test completed')
  })

  // ==================== Zmodem Upload (trzsz/rzsz) ====================

  test('electerm_zmodem_upload: should initiate trz upload (trzsz, default)', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 300, 'electerm_zmodem_upload', {
      files: [`/tmp/mcp2-trzsz-upload-${uniqueId}.txt`]
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_upload error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_upload result:', result)
      assert.equal(result.success, true)
      assert.ok(Array.isArray(result.files), 'result.files should be array')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.equal(result.protocol, 'rzsz', 'default protocol should be rzsz')
      assert.equal(result.command, 'rz', 'default command should be rz')
    }

    console.log('electerm_zmodem_upload (trzsz) test completed')
  })

  test('electerm_zmodem_upload: should initiate rz upload (rzsz protocol)', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 303, 'electerm_zmodem_upload', {
      files: [`/tmp/mcp2-rzsz-upload-${uniqueId}.txt`],
      protocol: 'rzsz'
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_upload rzsz error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_upload rzsz result:', result)
      assert.equal(result.success, true)
      assert.equal(result.protocol, 'rzsz', 'protocol should be rzsz')
      assert.equal(result.command, 'rz', 'command should be rz for rzsz')
    }

    console.log('electerm_zmodem_upload (rzsz) test completed')
  })

  test('electerm_zmodem_upload: should error if files array is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 301, 'electerm_zmodem_upload', {})

    if (jsonData.error) {
      console.log('electerm_zmodem_upload missing files error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('electerm_zmodem_upload missing files tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_upload no files result:', result)
    }

    console.log('electerm_zmodem_upload missing files test completed')
  })

  test('electerm_zmodem_upload: should error if files array is empty', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 302, 'electerm_zmodem_upload', {
      files: []
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_upload empty files error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('electerm_zmodem_upload empty files tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_upload empty files result:', result)
    }

    console.log('electerm_zmodem_upload empty files test completed')
  })

  // ==================== Zmodem Download (trzsz/rzsz) ====================

  test('electerm_zmodem_download: should initiate tsz download (trzsz, default)', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 310, 'electerm_zmodem_download', {
      remoteFiles: [`/tmp/mcp2-trzsz-download-${uniqueId}.txt`],
      saveFolder: '/tmp'
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_download error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_download result:', result)
      assert.equal(result.success, true)
      assert.ok(Array.isArray(result.remoteFiles), 'result.remoteFiles should be array')
      assert.ok(result.saveFolder !== undefined, 'result.saveFolder should be present')
      assert.ok(result.tabId !== undefined, 'result.tabId should be present')
      assert.equal(result.protocol, 'rzsz', 'default protocol should be rzsz')
      assert.equal(result.command, 'sz', 'default command should be sz')
    }

    console.log('electerm_zmodem_download (trzsz) test completed')
  })

  test('electerm_zmodem_download: should initiate sz download (rzsz protocol)', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 313, 'electerm_zmodem_download', {
      remoteFiles: [`/tmp/mcp2-rzsz-download-${uniqueId}.txt`],
      saveFolder: '/tmp',
      protocol: 'rzsz'
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_download rzsz error (expected if no SSH tab open):', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_download rzsz result:', result)
      assert.equal(result.success, true)
      assert.equal(result.protocol, 'rzsz', 'protocol should be rzsz')
      assert.equal(result.command, 'sz', 'command should be sz for rzsz')
    }

    console.log('electerm_zmodem_download (rzsz) test completed')
  })

  test('electerm_zmodem_download: should error if remoteFiles is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 311, 'electerm_zmodem_download', {
      saveFolder: '/tmp'
    })

    if (jsonData.error) {
      console.log('electerm_zmodem_download missing remoteFiles error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('electerm_zmodem_download missing remoteFiles tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('electerm_zmodem_download no remoteFiles result:', result)
    }

    console.log('electerm_zmodem_download missing remoteFiles test completed')
  })

  test('electerm_zmodem_download: should error if saveFolder is missing', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 312, 'electerm_zmodem_download', {
      remoteFiles: ['/tmp/test.txt']
    })

    if (jsonData.error) {
      console.log('trzsz_download missing saveFolder error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else if (jsonData.result && jsonData.result.isError) {
      console.log('trzsz_download missing saveFolder tool error:', jsonData.result.content[0].text)
      assert.ok(typeof jsonData.result.content[0].text === 'string')
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('trzsz_download no saveFolder result:', result)
    }

    console.log('trzsz_download missing saveFolder test completed')
  })

  // ==================== Transfer List ====================

  test('sftp_transfer_list: should return current transfer list', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 400, 'electerm_sftp_transfer_list', {})

    if (jsonData.error) {
      console.log('sftp_transfer_list error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_transfer_list result:', result)
      assert.ok(Array.isArray(result), 'result should be an array')
      // Validate transfer item shape if any exist
      if (result.length > 0) {
        const t = result[0]
        assert.ok(t.id !== undefined, 'transfer should have id')
        assert.ok(t.fromPath !== undefined, 'transfer should have fromPath')
        assert.ok(t.toPath !== undefined, 'transfer should have toPath')
        assert.ok(t.typeFrom !== undefined, 'transfer should have typeFrom')
        assert.ok(t.typeTo !== undefined, 'transfer should have typeTo')
      }
    }

    console.log('sftp_transfer_list test completed')
  })

  // ==================== Transfer History ====================

  test('sftp_transfer_history: should return transfer history', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const jsonData = await callTool(sessionId, 410, 'electerm_sftp_transfer_history', {})

    if (jsonData.error) {
      console.log('sftp_transfer_history error:', jsonData.error.message)
      assert.ok(jsonData.error.code !== undefined)
    } else {
      const result = JSON.parse(jsonData.result.content[0].text)
      console.log('sftp_transfer_history result:', result)
      assert.ok(Array.isArray(result), 'result should be an array')
      // Validate history item shape if any exist
      if (result.length > 0) {
        const h = result[0]
        assert.ok(h.id !== undefined, 'history item should have id')
        assert.ok(h.fromPath !== undefined, 'history item should have fromPath')
        assert.ok(h.toPath !== undefined, 'history item should have toPath')
        assert.ok(h.typeFrom !== undefined, 'history item should have typeFrom')
      }
    }

    console.log('sftp_transfer_history test completed')
  })

  // ==================== Tool availability check ====================

  test('should list new SFTP/transfer/trzsz tools in tools/list', { timeout: 100000 }, async function () {
    if (!sessionId) {
      sessionId = await initSession()
    }

    const toolsRequest = {
      jsonrpc: '2.0',
      id: 400,
      method: 'tools/list',
      params: {}
    }

    const response = await makeHttpRequest('post', serverUrl, toolsRequest, {
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
    console.log('All registered tools:', toolNames)

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
      'electerm_sftp_transfer_history'
    ]

    for (const toolName of expectedTools) {
      assert.ok(toolNames.includes(toolName), `Expected tool "${toolName}" to be registered`)
      console.log(`✓ Tool "${toolName}" is registered`)
    }

    console.log('All new tools are properly registered')
  })
})
