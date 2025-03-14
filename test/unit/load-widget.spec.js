const {
  test: it, expect
} = require('@playwright/test')
const { describe } = it
const { listWidgets, runWidget, stopWidget } = require('../../src/app/widgets/load-widget')
const os = require('os')
const path = require('path')
const fs = require('fs/promises')
const axios = require('axios')
it.setTimeout(100000)

describe('load-widget', function () {
  let serverInstance = null
  let testDir = null
  let serverUrl = null

  // Helper to create test files
  async function createTestFiles () {
    testDir = path.join(os.tmpdir(), 'electerm-test-' + Date.now())
    await fs.mkdir(testDir)

    // Create a test index.html
    const htmlContent = `
      <!DOCTYPE html>
<html>
<head>
<title>
Test Page

</title>
</head>
<body>
<h1>
Hello from Electerm Test

</h1>
<p>
This is a test page served by local-file-server widget.

</p>
<p>
Timestamp: ${new Date().toISOString()}

</p>
</body>
</html>
`
    await fs.writeFile(path.join(testDir, 'index.html'), htmlContent)
  }

  // Cleanup helper
  async function cleanup () {
    if (serverInstance) {
      await stopWidget(serverInstance)
      serverInstance = null
    }
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch (err) {
        console.error('Cleanup error:', err)
      }
    }
  }

  // Setup before tests
  it.beforeEach(async () => {
    await createTestFiles()
  })

  // Cleanup after tests
  it.afterEach(async () => {
    await cleanup()
  })

  // Test listWidgets function
  it('listWidgets should list available widgets', async function () {
    const widgets = listWidgets()
    console.log(widgets)
    expect(Array.isArray(widgets)).toBe(true)
    expect(widgets.length).toBeGreaterThan(0)

    const fileServer = widgets.find(w => w.id === 'local-file-server')
    expect(fileServer).toBeTruthy()
  })

  // Test runWidget function with file serving
  it('should run local-file-server widget and serve files', async function () {
    const config = {
      directory: testDir,
      port: 3457,
      host: '127.0.0.1',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      cacheControl: true,
      lastModified: true,
      etag: true,
      dotfiles: 'allow',
      redirect: true,
      acceptRanges: true,
      index: 'index.html'
    }

    try {
      const result = await runWidget('local-file-server', config)
      expect(result).toBeTruthy()
      expect(result.instanceId).toBeTruthy()
      expect(result.serverInfo).toBeTruthy()
      expect(result.serverInfo.url).toBe(`http://${config.host}:${config.port}`)
      expect(result.serverInfo.path).toBe(config.directory)

      serverInstance = result.instanceId
      serverUrl = result.serverInfo.url

      // Test file serving
      const response = await axios.get(serverUrl)
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toMatch(/text\/html/)
      expect(response.data).toContain('Hello from Electerm Test')

      // Test caching headers
      expect(response.headers['cache-control']).toBeTruthy()
      expect(response.headers.etag).toBeTruthy()
      expect(response.headers['last-modified']).toBeTruthy()

      // Test non-existent file
      try {
        await axios.get(`${serverUrl}/non-existent.html`)
        throw new Error('Should have thrown 404')
      } catch (err) {
        expect(err.response.status).toBe(404)
      }
    } catch (err) {
      console.log('run widget error:', err)
      throw err
    }
  })

  // Test directory listing (if enabled)
  it('should handle directory requests properly', async function () {
    if (!serverInstance || !serverUrl) {
      const config = {
        directory: testDir,
        port: 3457,
        host: '127.0.0.1',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        cacheControl: true,
        lastModified: true,
        etag: true,
        dotfiles: 'allow',
        redirect: true,
        acceptRanges: true,
        index: 'index.html'
      }
      const result = await runWidget('local-file-server', config)
      serverInstance = result.instanceId
      serverUrl = result.serverInfo.url
    }

    // Create a subdirectory with a file
    const subDir = path.join(testDir, 'subdir')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'index.html'), 'Test content')

    // Test directory redirect (should redirect to index.html)
    const response = await axios.get(`${serverUrl}/subdir/`)
    expect(response.status).toBe(200)
  })

  // Test stopWidget function
  it('should stop running widget', async function () {
    if (!serverInstance) {
      console.log('No server instance to stop')
      return
    }

    const result = await stopWidget(serverInstance)
    expect(result).toBeTruthy()
    expect(result.instanceId).toBe(serverInstance)
    expect(result.status).toBe('stopped')

    // Verify server is actually stopped
    try {
      await axios.get(serverUrl)
      throw new Error('Server should be stopped')
    } catch (err) {
      expect(err.code).toBe('ECONNREFUSED')
    }
  })

  // Test error cases
  it('should handle stopping non-existent widget', async function () {
    const result = await stopWidget('non-existent-id')
    expect(result).toBeUndefined()
  })

  it('should handle invalid widget ID', async function () {
    try {
      await runWidget('non-existent-widget', {})
      throw new Error('Should have thrown an error')
    } catch (error) {
      expect(error).toBeTruthy()
    }
  })
})
