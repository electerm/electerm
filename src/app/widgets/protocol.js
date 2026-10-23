/**
 * electerm-widget://<id>/<file> — serves one user widget folder to the renderer.
 *
 * Why a protocol and not http: the widget UI is untrusted-ish code that ships
 * after the app does, it must load in dev and in a packaged build the same way,
 * and its origin must be distinct from the app's so it cannot reach window.store
 * directly. A privileged custom scheme gives all three for free, with no second
 * http server and no platform-specific data-dir guessing (the main process
 * resolves DATA_PATH, the server child does not).
 *
 * The html of a widget gets the bridge script injected on the fly, so
 * window.electerm exists without the author adding a script tag.
 *
 * This is the Electron >= 25 implementation, and nothing else: the legacy
 * builds (Electron 22, pinned for old glibc) get `protocol-legacy.js` copied
 * next to this file and the body of initWidgetProtocol() rewritten at build
 * time — see src/build/bin/inject-polyfills.js. Keeping the fallback out of
 * here means the code that ships only ever calls an API its Electron has.
 */

const fs = require('fs')
const path = require('path')
const { protocol, net } = require('electron')
const { pathToFileURL } = require('url')
const { isValidWidgetId, resolveUserWidgetDir, isInside } = require('./paths')
const bridgeSource = require('./bridge')

const SCHEME = 'electerm-widget'
const BRIDGE_PATH = '/__bridge.js'
const HTML_EXT = /\.html?$/i

const NOT_FOUND = { status: 404 }

// Serve by ourselves (bridge, injected html) needs an explicit type; files go
// through net.fetch, which sniffs the extension for us.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

function mimeTypeOf (file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

// Put the bridge first in <head> so window.electerm exists before any script
// the widget loads from there.
function injectBridge (html) {
  const tag = `<script src="${BRIDGE_PATH}"></script>`
  const head = /<head[^>]*>/i.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return html.slice(0, at) + tag + html.slice(at)
  }
  const root = /<html[^>]*>/i.exec(html)
  if (root) {
    const at = root.index + root[0].length
    return html.slice(0, at) + tag + html.slice(at)
  }
  return tag + html
}

/**
 * Resolve one request to a plain descriptor, free of `Response` and of any
 * protocol API:
 *   { status: 200, mimeType, body: Buffer }  — served from memory (bridge, html)
 *   { status: 200, mimeType, file }          — served from disk
 *   { status: 404 }
 * The legacy builds' adapter consumes the same descriptor, so a widget gets the
 * same files and the same types on either Electron.
 */
function resolveWidgetRequest (requestUrl) {
  let url
  try {
    url = new URL(requestUrl)
  } catch (e) {
    return NOT_FOUND
  }
  // electerm-widget://<id>/<path inside the widget folder>
  const id = url.hostname
  if (!isValidWidgetId(id)) {
    return NOT_FOUND
  }
  if (url.pathname === BRIDGE_PATH) {
    return {
      status: 200,
      mimeType: 'text/javascript; charset=utf-8',
      body: Buffer.from(bridgeSource)
    }
  }
  let root
  try {
    root = resolveUserWidgetDir(id)
  } catch (e) {
    return NOT_FOUND
  }
  let rel
  try {
    rel = decodeURIComponent(url.pathname)
  } catch (e) {
    return NOT_FOUND
  }
  rel = rel.replace(/^\/+/, '')
  if (!rel) {
    return NOT_FOUND
  }
  const file = path.resolve(root, rel)
  if (!isInside(root, file) || file.includes('\0')) {
    return NOT_FOUND
  }
  let stat
  try {
    stat = fs.statSync(file)
  } catch (e) {
    return NOT_FOUND
  }
  if (!stat.isFile()) {
    return NOT_FOUND
  }
  if (HTML_EXT.test(file)) {
    try {
      const html = fs.readFileSync(file, 'utf8')
      return {
        status: 200,
        mimeType: 'text/html; charset=utf-8',
        body: Buffer.from(injectBridge(html))
      }
    } catch (e) {
      return NOT_FOUND
    }
  }
  return { status: 200, mimeType: mimeTypeOf(file), file }
}

// Electron >= 25: web Request in, web Response out.
async function serveWidgetFile (request) {
  const res = resolveWidgetRequest(request.url)
  if (res.status !== 200) {
    return new Response('Not found', { status: 404 })
  }
  if (res.body) {
    return new Response(res.body, {
      headers: { 'content-type': res.mimeType }
    })
  }
  return net.fetch(pathToFileURL(res.file).toString())
}

// Must run before app ready.
function registerWidgetScheme () {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

// After app ready, before the window starts loading widget panels.
//
// Keep this body a single protocol.handle() call: legacy builds replace exactly
// these three lines (see LEGACY_INIT in src/build/bin/inject-polyfills.js), and
// the build fails loudly if the shape drifts.
function initWidgetProtocol () {
  protocol.handle(SCHEME, serveWidgetFile)
}

module.exports = {
  SCHEME,
  registerWidgetScheme,
  initWidgetProtocol,
  resolveWidgetRequest,
  serveWidgetFile
}
