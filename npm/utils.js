/**
 * Utility functions for npm installer
 * Replaces download and phin packages with native Node.js http/https and tar
 * Supports Node.js 16+
 * Supports GITHUB_PROXY environment variable for proxying GitHub URLs
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const tar = require('tar')

// GitHub proxy support
const GITHUB_PROXY = process.env.GITHUB_PROXY || ''

/**
 * Apply GitHub proxy to URLs if configured
 * @param {string} url - Original URL
 * @returns {string} - Proxy URL or original URL
 */
function applyProxy (url) {
  if (!GITHUB_PROXY) return url
  if (!url.includes('github.com')) return url

  // Remove trailing slash from proxy if present
  const proxy = GITHUB_PROXY.replace(/\/+$/, '')
  // Ensure url has protocol
  const urlWithProto = url.startsWith('http') ? url : `https://${url}`

  return `${proxy}/${urlWithProto}`
}

/**
 * Format bytes to human readable
 */
function formatBytes (bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Make an HTTP GET request and download to a file with progress
 * @param {string} url - URL to fetch
 * @param {string} filepath - Destination file path
 * @param {number} timeout - Request timeout in milliseconds (default: 300000 = 5min)
 * @param {function} onProgress - Progress callback (received, total, percent)
 * @returns {Promise<string>} Path to downloaded file
 */
function httpDownload (url, filepath, timeout = 300000, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        if (res.headers.location) {
          // Handle relative URLs
          let redirectUrl = res.headers.location
          if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            const parsedUrl = new URL(url)
            redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`
          }
          resolve(httpDownload(redirectUrl, filepath, timeout, onProgress))
          return
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`))
        return
      }

      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      let lastPercent = -1

      const fileStream = fs.createWriteStream(filepath)

      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress && total > 0) {
          const percent = Math.round((received / total) * 100)
          if (percent !== lastPercent) {
            lastPercent = percent
            onProgress(received, total, percent)
          }
        }
      })

      res.pipe(fileStream)
      fileStream.on('finish', () => {
        fileStream.close()
        resolve(filepath)
      })
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {}) // Clean up partial download
        reject(err)
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout after ${timeout}ms`))
    })
  })
}

/**
 * Make an HTTP GET request and return response body as string
 * @param {string} url - URL to fetch
 * @param {number} timeout - Request timeout in milliseconds (default: 15000)
 * @returns {Promise<string>} Response body as string
 */
function httpGet (url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        if (res.headers.location) {
          // Handle relative URLs
          let redirectUrl = res.headers.location
          if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            const parsedUrl = new URL(url)
            redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`
          }
          resolve(httpGet(redirectUrl, timeout))
          return
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`))
        return
      }

      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer.toString())
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout after ${timeout}ms`))
    })
  })
}

/**
 * Extract a tar.gz file to destination directory
 * @param {string} filepath - Path to tar.gz file
 * @param {string} dest - Destination directory
 * @param {number} strip - Number of leading path components to strip (default: 0)
 * @returns {Promise<void>}
 */
function extractTarGz (filepath, dest, strip = 0) {
  return tar.extract({
    file: filepath,
    cwd: dest,
    strip
  })
}

/**
 * Download and optionally extract a file with progress
 * @param {string} url - URL to download from
 * @param {string} dest - Destination directory
 * @param {object} options - Options
 * @param {boolean} options.extract - Whether to extract the file (default: true)
 * @param {string} options.displayName - Display name for progress output
 * @returns {Promise<{filepath: string, extracted: boolean}>}
 */
async function download (url, dest, { extract: doExtract = true, displayName } = {}) {
  // Ensure dest directory exists
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  // Extract filename from URL
  const urlParts = url.split('/')
  const filename = urlParts[urlParts.length - 1].split('?')[0] || 'download'
  const filepath = path.join(dest, filename)

  // Apply proxy if configured
  const downloadUrl = applyProxy(url)

  const label = displayName || filename
  const proxyInfo = GITHUB_PROXY ? ' [via proxy]' : ''

  console.log('')
  console.log(`  Downloading: ${label}${proxyInfo}`)

  let lastPercent = -1
  await httpDownload(downloadUrl, filepath, 300000, (received, total, percent) => {
    if (percent !== lastPercent && percent % 10 === 0) {
      lastPercent = percent
      const receivedStr = formatBytes(received)
      const totalStr = formatBytes(total)
      process.stdout.write(`  Progress: ${percent}% (${receivedStr} / ${totalStr})\n`)
    }
  })

  console.log(`  Progress: 100% (${formatBytes(fs.statSync(filepath).size)})`)
  console.log('  Download complete!')

  let extracted = false
  if (doExtract && (filepath.endsWith('.tar.gz') || filepath.endsWith('.tgz'))) {
    console.log('  Extracting archive...')
    await extractTarGz(filepath, dest)
    // Clean up the downloaded archive
    try {
      fs.unlinkSync(filepath)
    } catch (err) {
      // Ignore cleanup errors
    }
    extracted = true
    console.log('  Extraction complete!')
  }

  return { filepath, extracted }
}

/**
 * Phin replacement - simple promisified HTTP client
 * @param {object} options - Request options
 * @param {string} options.url - URL to fetch
 * @param {number} options.timeout - Request timeout (default: 15000)
 * @returns {Promise<{body: Buffer, statusCode: number, headers: object}>}
 */
async function phin (options) {
  const { url, timeout = 15000 } = options
  const body = await httpGet(url, timeout)

  return {
    body: Buffer.from(body),
    statusCode: 200,
    headers: {}
  }
}

phin.promisified = phin

module.exports = {
  httpGet,
  httpDownload,
  extractTarGz,
  download,
  phin,
  applyProxy,
  formatBytes,
  GITHUB_PROXY
}
