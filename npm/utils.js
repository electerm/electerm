/**
 * Utility functions for npm installer
 * Replaces download and phin packages with native Node.js http/https and tar
 * Supports Node.js 16+
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const tar = require('tar')

/**
 * Make an HTTP GET request
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
          resolve(httpGet(res.headers.location, timeout))
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
 * Download a file from URL to local path
 * @param {string} url - URL to download from
 * @param {string} dest - Destination directory path
 * @returns {Promise<string>} Path to downloaded file
 */
function downloadFile (url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout: 300000 }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        if (res.headers.location) {
          resolve(downloadFile(res.headers.location, dest))
          return
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`))
        return
      }

      // Extract filename from URL or Content-Disposition header
      let filename = 'download'
      const contentDisposition = res.headers['content-disposition']
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]*)\1/)
        if (match) {
          filename = match[2]
        }
      } else {
        const urlParts = url.split('/')
        filename = urlParts[urlParts.length - 1].split('?')[0] || 'download'
      }

      const filepath = path.join(dest, filename)
      const fileStream = fs.createWriteStream(filepath)

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
      reject(new Error('Download timeout after 300s'))
    })
  })
}

/**
 * Extract a tar.gz file to destination directory
 * @param {string} filepath - Path to tar.gz file
 * @param {string} dest - Destination directory
 * @returns {Promise<void>}
 */
function extractTarGz (filepath, dest) {
  return tar.extract({
    file: filepath,
    cwd: dest,
    strip: 1 // Strip top-level directory
  })
}

/**
 * Download and optionally extract a file
 * Replaces the download package functionality
 * @param {string} url - URL to download from
 * @param {string} dest - Destination directory
 * @param {boolean} extract - Whether to extract the file (default: true)
 * @returns {Promise<void>}
 */
async function download (url, dest, { extract: doExtract = true } = {}) {
  console.log('downloading ' + url)

  const filepath = await downloadFile(url, dest)

  if (doExtract && (filepath.endsWith('.tar.gz') || filepath.endsWith('.tgz'))) {
    await extractTarGz(filepath, dest)
    // Clean up the downloaded archive
    try {
      fs.unlinkSync(filepath)
    } catch (err) {
      console.warn('Warning: Failed to clean up downloaded archive:', err.message)
    }
  }

  console.log('done!')
}

/**
 * Phin replacement - simple promisified HTTP client
 * @param {object} options - Request options
 * @param {string} options.url - URL to fetch
 * @param {number} options.timeout - Request timeout (default: 15000)
 * @returns {Promise<{body: string, statusCode: number, headers: object}>}
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

// Export promisified version
phin.promisified = phin

module.exports = {
  httpGet,
  downloadFile,
  extractTarGz,
  download,
  phin
}
