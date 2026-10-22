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

function notFound () {
  return new Response('Not found', { status: 404 })
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

async function serveWidgetFile (request) {
  let url
  try {
    url = new URL(request.url)
  } catch (e) {
    return notFound()
  }
  // electerm-widget://<id>/<path inside the widget folder>
  const id = url.hostname
  if (!isValidWidgetId(id)) {
    return notFound()
  }
  if (url.pathname === BRIDGE_PATH) {
    return new Response(bridgeSource, {
      headers: { 'content-type': 'text/javascript; charset=utf-8' }
    })
  }
  let root
  try {
    root = resolveUserWidgetDir(id)
  } catch (e) {
    return notFound()
  }
  let rel
  try {
    rel = decodeURIComponent(url.pathname)
  } catch (e) {
    return notFound()
  }
  rel = rel.replace(/^\/+/, '')
  if (!rel) {
    return notFound()
  }
  const file = path.resolve(root, rel)
  if (!isInside(root, file) || file.includes('\0')) {
    return notFound()
  }
  let stat
  try {
    stat = fs.statSync(file)
  } catch (e) {
    return notFound()
  }
  if (!stat.isFile()) {
    return notFound()
  }
  if (HTML_EXT.test(file)) {
    try {
      const html = fs.readFileSync(file, 'utf8')
      return new Response(injectBridge(html), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    } catch (e) {
      return notFound()
    }
  }
  return net.fetch(pathToFileURL(file).toString())
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
function initWidgetProtocol () {
  protocol.handle(SCHEME, serveWidgetFile)
}

module.exports = {
  SCHEME,
  registerWidgetScheme,
  initWidgetProtocol,
  serveWidgetFile
}
