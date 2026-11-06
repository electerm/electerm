/**
 * Download an icon into `<data dir>/icons`.
 *
 * The bookmark only ever stores the resulting local path, never the URL: a
 * bookmark is synced, imported and written by AI/MCP callers, and rendering one
 * must not make the client fetch a host that a bookmark file pointed at. The
 * fetch happens here, once, because the user asked for this URL in the picker.
 *
 * Files are content addressed (sha256 prefix), so picking the same icon twice,
 * or in two bookmarks, keeps one file.
 */

const fs = require('fs/promises')
const path = require('path')
const http = require('http')
const https = require('https')
const { createHash } = require('crypto')
const { getDataDir } = require('../widgets/paths')

const ICONS_DIR_NAME = 'icons'
const MAX_ICON_SIZE = 512 * 1024
const REQUEST_TIMEOUT = 10000
const MAX_REDIRECTS = 3

// formats an <img> can show, mirrored in src/client/common/icon-value.js
const EXTENSIONS = [
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'avif'
]

const MIME_EXTENSIONS = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif'
}

function getIconDir () {
  return path.join(getDataDir(), ICONS_DIR_NAME)
}

async function ensureIconDir () {
  const dir = getIconDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function bySignature (buffer) {
  const head = buffer.slice(0, 300).toString('utf8').trim()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'svg'
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    return 'png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpg'
  }
  if (buffer.slice(0, 4).toString('utf8') === 'GIF8') {
    return 'gif'
  }
  if (buffer.slice(8, 12).toString('utf8') === 'WEBP') {
    return 'webp'
  }
  return ''
}

/**
 * Best guess for the file extension: declared content type first (servers get
 * that right most of the time), then the URL, then the bytes. svg is the last
 * resort, it is the format these icons are meant to be.
 */
function detectExtension (contentType, urlPath, buffer) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (MIME_EXTENSIONS[type]) {
    return MIME_EXTENSIONS[type]
  }
  const fromUrl = path.extname(urlPath || '').slice(1).toLowerCase()
  if (EXTENSIONS.includes(fromUrl)) {
    return fromUrl
  }
  return bySignature(buffer) || 'svg'
}

function request (target, redirects) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = new URL(target)
    } catch (err) {
      return reject(new Error('invalid URL'))
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return reject(new Error('only http and https are supported'))
    }
    const client = url.protocol === 'https:' ? https : http
    const req = client.get(url, {
      headers: {
        // some CDNs hand out a different (or no) image to unknown agents
        'user-agent': 'Mozilla/5.0 (compatible; electerm-icon-fetch)',
        accept: 'image/*,*/*;q=0.8'
      },
      timeout: REQUEST_TIMEOUT
    }, res => {
      const { statusCode, headers } = res
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume()
        if (redirects >= MAX_REDIRECTS) {
          return reject(new Error('too many redirects'))
        }
        const next = new URL(headers.location, url).toString()
        return resolve(request(next, redirects + 1))
      }
      if (statusCode !== 200) {
        res.resume()
        return reject(new Error(`icon download failed: HTTP ${statusCode}`))
      }
      const type = String(headers['content-type'] || '')
      if (/^text\/html/i.test(type)) {
        res.resume()
        return reject(new Error('icon download failed: got an HTML page, not an image'))
      }
      const declared = Number(headers['content-length'] || 0)
      if (declared > MAX_ICON_SIZE) {
        res.resume()
        return reject(new Error('icon is too large (max 512KB)'))
      }
      const chunks = []
      let size = 0
      res.on('data', chunk => {
        size += chunk.length
        if (size > MAX_ICON_SIZE) {
          req.destroy(new Error('icon is too large (max 512KB)'))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: type,
          url
        })
      })
      res.on('error', reject)
    })
    req.on('timeout', () => {
      req.destroy(new Error('icon download timed out'))
    })
    req.on('error', reject)
  })
}

/**
 * Download `value` and store it under the data dir.
 * @param {string} value http(s) URL
 * @returns {Promise<string>} absolute path of the stored icon
 */
async function saveIconFromUrl (value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('invalid URL')
  }
  const { buffer, contentType, url } = await request(value.trim(), 0)
  if (!buffer.length) {
    throw new Error('icon download failed: empty response')
  }
  const extension = detectExtension(contentType, url.pathname, buffer)
  const name = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  const dir = await ensureIconDir()
  const filePath = path.join(dir, `${name}.${extension}`)
  await fs.writeFile(filePath, buffer, { mode: 0o644 })
  return filePath
}

module.exports = {
  ICONS_DIR_NAME,
  MAX_ICON_SIZE,
  detectExtension,
  getIconDir,
  saveIconFromUrl
}
