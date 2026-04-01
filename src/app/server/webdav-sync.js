/**
 * handle sync with WebDAV server
 */

const log = require('../common/log')
const rp = require('axios')
const { createProxyAgent } = require('../lib/proxy-agent')

rp.defaults.proxy = false

/**
 * Create an axios client for WebDAV operations
 */
function createClient (serverUrl, username, password, proxy) {
  const agent = createProxyAgent(proxy)
  const conf = agent
    ? { httpsAgent: agent }
    : { proxy: false }

  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  return rp.create({
    ...conf,
    baseURL: serverUrl,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    // do not throw on non-2xx so we can log status codes
    validateStatus: () => true
  })
}

/**
 * Ensure directory exists on WebDAV server
 */
async function ensureDir (client, dirPath) {
  log.info(`[WebDAV] ensureDir: ${dirPath}`)
  const res = await client.request({
    method: 'MKCOL',
    url: dirPath
  })
  log.info(`[WebDAV] ensureDir: ${dirPath} -> ${res.status}`)
  // 201 created, 405 already exists, 200 ok
  if (res.status !== 201 && res.status !== 405 && res.status !== 200) {
    throw new Error(`MKCOL ${dirPath} returned ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`)
  }
}

/**
 * Upload a file to WebDAV server
 */
async function uploadFile (client, filePath, content) {
  log.info(`[WebDAV] uploadFile: ${filePath}`)
  const body = typeof content === 'string' ? content : JSON.stringify(content)
  const res = await client.request({
    method: 'PUT',
    url: filePath,
    data: body,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
  log.info(`[WebDAV] uploadFile: ${filePath} -> ${res.status}`)
  if (res.status >= 200 && res.status < 300) {
    return { success: true }
  }
  const msg = `PUT ${filePath} returned ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`
  log.error(`[WebDAV] ${msg}`)
  return { error: { message: msg } }
}

/**
 * Download a file from WebDAV server
 */
async function downloadFile (client, filePath) {
  log.info(`[WebDAV] downloadFile: ${filePath}`)
  const res = await client.request({
    method: 'GET',
    url: filePath
  })
  log.info(`[WebDAV] downloadFile: ${filePath} -> ${res.status}`)
  if (res.status === 404) {
    return null
  }
  if (res.status >= 200 && res.status < 300) {
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  }
  const msg = `GET ${filePath} returned ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`
  log.error(`[WebDAV] ${msg}`)
  return { error: { message: msg } }
}

/**
 * Test connection to WebDAV server
 */
async function test (serverUrl, username, password, proxy) {
  const client = createClient(serverUrl, username, password, proxy)
  try {
    log.info(`[WebDAV] test: probing ${serverUrl}`)
    const res = await client.request({
      method: 'PROPFIND',
      url: '/',
      headers: {
        Depth: '0'
      }
    })
    log.info(`[WebDAV] test: PROPFIND / -> ${res.status}`)
    if (res.status === 207 || res.status === 200) {
      return { success: true, status: res.status }
    }
    return { error: { message: `WebDAV server returned ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}` } }
  } catch (err) {
    log.error('[WebDAV] test error:', err.message)
    log.error('[WebDAV] test error stack:', err.stack)
    return { error: { message: err.message } }
  }
}

/**
 * Upload electerm data to WebDAV server
 */
async function upload (serverUrl, username, password, data, proxy) {
  const client = createClient(serverUrl, username, password, proxy)
  const basePath = '/electerm'

  try {
    log.info(`[WebDAV] upload: starting to ${serverUrl}${basePath}`)
    log.info(`[WebDAV] upload: data keys = [${Object.keys(data).join(', ')}]`)

    // Ensure electerm directory exists
    await ensureDir(client, basePath)

    // Upload each file
    for (const [filename, content] of Object.entries(data)) {
      const filePath = `${basePath}/${filename}`
      const result = await uploadFile(client, filePath, content)
      if (result.error) {
        return { error: { message: `Failed to upload ${filename}: ${result.error.message}` } }
      }
    }

    log.info('[WebDAV] upload: complete')
    return { success: true }
  } catch (err) {
    log.error('[WebDAV] upload error:', err.message)
    log.error('[WebDAV] upload error stack:', err.stack)
    return { error: { message: err.message } }
  }
}

/**
 * Download electerm data from WebDAV server
 */
async function download (serverUrl, username, password, proxy) {
  const client = createClient(serverUrl, username, password, proxy)
  const basePath = '/electerm'

  try {
    log.info(`[WebDAV] download: starting from ${serverUrl}${basePath}`)

    const result = {
      files: {}
    }

    const fileList = [
      'settings.json',
      'bookmarks.json',
      'bookmarkGroups.json',
      'terminalThemes.json',
      'quickCommands.json',
      'profiles.json',
      'addressBookmarks.json',
      'workspaces.json',
      'userConfig.json',
      'electerm-status.json',
      'settings.order.json',
      'bookmarks.order.json',
      'bookmarkGroups.order.json',
      'terminalThemes.order.json',
      'quickCommands.order.json',
      'profiles.order.json',
      'addressBookmarks.order.json',
      'workspaces.order.json'
    ]

    for (const filename of fileList) {
      const filePath = `${basePath}/${filename}`
      const content = await downloadFile(client, filePath)
      if (content && typeof content === 'string') {
        result.files[filename] = {
          content
        }
        log.info(`[WebDAV] download: got ${filename} (${content.length} chars)`)
      }
    }

    log.info(`[WebDAV] download: complete, got ${Object.keys(result.files).length} files`)
    return result
  } catch (err) {
    log.error('[WebDAV] download error:', err.message)
    log.error('[WebDAV] download error stack:', err.stack)
    return { error: { message: err.message } }
  }
}

/**
 * Main WebDAV sync handler
 */
async function doWebdavSync (func, args, token, proxy) {
  log.info(`[WebDAV] doWebdavSync: func=${func}`)

  // token format: serverUrl####username####password
  const parts = token ? token.split('####') : []
  const serverUrl = parts[0] || ''
  const username = parts[1] || ''
  const password = parts[2] || ''

  log.info(`[WebDAV] serverUrl=${serverUrl}, username=${username}`)

  if (!serverUrl) {
    const msg = 'WebDAV server URL is not configured'
    log.error(`[WebDAV] ${msg}`)
    return { error: { message: msg } }
  }

  try {
    switch (func) {
      case 'test':
        return await test(serverUrl, username, password, proxy)
      case 'upload':
        return await upload(serverUrl, username, password, args[0], proxy)
      case 'download':
        return await download(serverUrl, username, password, proxy)
      default: {
        const msg = `Unknown WebDAV function: ${func}`
        log.error(`[WebDAV] ${msg}`)
        return { error: { message: msg } }
      }
    }
  } catch (err) {
    log.error('[WebDAV] sync error:', err.message)
    log.error('[WebDAV] sync error stack:', err.stack)
    return { error: { message: err.message } }
  }
}

module.exports = doWebdavSync
