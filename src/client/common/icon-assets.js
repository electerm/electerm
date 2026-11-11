/**
 * Turn a stored icon value into something an <img> can show.
 *
 * Built-in icons are static files served under /icons, so they need nothing
 * more than a URL. A local file has to be read through the app (`window.fs`),
 * which works in the desktop app and in the web build alike, and the result is
 * cached per path because a bookmark list can have dozens of rows and re-render
 * on every scroll frame.
 *
 * A downloaded icon (icon-download.js writes it into `<data dir>/icons`) is the
 * one case the web build can do better: the folder has an http route
 * (app/routes/icon.js), so the row can point an `<img>` at a url the browser
 * caches instead of pulling a base64 string over the ws for every render. That
 * is what `iconServePath` + `iconDir` are for, both injected by the app and
 * both absent in the desktop app, which has no http origin to serve from.
 */

import fs from './fs'
import { iconMimeType } from './icon-value'
import { webUrl } from './web-url'

const cache = new Map()

/**
 * URL of a built-in icon (electerm-icons). `extIconPath` is injected by the app
 * (src/app/common/runtime-constants.js) and differs between dev and packaged
 * builds.
 * @param {string} name
 */
export function builtinIconUrl (name) {
  const base = (window.et && window.et.extIconPath) ||
    (window.pre && window.pre.extIconPath) ||
    // last resort, only reached when the app injected no path at all: still
    // resolve it, so a sub-path deployment does not 404 every built-in icon
    webUrl('/icons/')
  return `${base}${name}.svg`
}

/**
 * Where the web build serves `<data dir>/icons` over http, and where that
 * folder is on disk. Empty in the desktop app.
 * @returns {{base: string, dir: string}|null}
 */
function iconServe () {
  const et = window.et || {}
  const pre = window.pre || {}
  const base = et.iconServePath || pre.iconServePath || ''
  const dir = et.iconDir || pre.iconDir || ''
  // both or neither: the url prefix is useless without knowing which files it
  // can address, and the folder alone has no origin to hang a path off
  return base && dir ? { base, dir } : null
}

function isWinPath (value) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')
}

/**
 * Path in one shape for comparison: separators unified, trailing slash gone,
 * case folded on windows (where the app and the browser may spell it either
 * way, and the drive letter differs in case by origin).
 * @param {string} value
 */
function normalizePath (value) {
  const raw = String(value || '')
  const unified = raw.replace(/\\/g, '/').replace(/\/+$/, '')
  return isWinPath(raw) ? unified.toLowerCase() : unified
}

/**
 * URL for a stored icon file, or '' when it is not one the route can serve.
 *
 * The route takes a bare file name, so only a direct child of the icons folder
 * gets a url; anything else is still read through `window.fs`. That keeps the
 * desktop-picked path (an arbitrary absolute path, synced in from another
 * machine) working instead of turning it into a 404 that would render as "no
 * icon". The name comes from content addressing (a sha256 prefix), so the url
 * can be cached forever.
 * @param {string} filePath
 * @returns {string}
 */
function servedIconUrl (filePath) {
  const serve = iconServe()
  if (!serve) {
    return ''
  }
  const file = normalizePath(filePath)
  const dir = normalizePath(serve.dir)
  const cut = file.lastIndexOf('/')
  if (cut < 0 || file.slice(0, cut) !== dir) {
    return ''
  }
  return serve.base + encodeURIComponent(file.slice(cut + 1))
}

/**
 * Absolute local icon file as a data URL. Resolves to '' when the file cannot
 * be read, so the caller falls back to the colour.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export function loadFileIcon (filePath) {
  // a served icon needs no round trip and no cache entry: the url is cheap to
  // rebuild and the browser caches the bytes behind it
  const served = servedIconUrl(filePath)
  if (served) {
    return Promise.resolve(served)
  }
  if (cache.has(filePath)) {
    return cache.get(filePath)
  }
  const job = fs.readFileAsBase64(filePath)
    .then(content => {
      return content
        ? `data:${iconMimeType(filePath)};base64,${content}`
        : ''
    })
    .catch(() => '')
    .then(url => {
      // do not remember a failure: the file may be there the next time the row
      // is rendered (an unmounted drive, a sync in progress)
      if (!url) {
        cache.delete(filePath)
      }
      return url
    })
  cache.set(filePath, job)
  return job
}

/**
 * Drop a cached file, e.g. after the user picked it again and replaced it.
 * @param {string} filePath
 */
export function forgetFileIcon (filePath) {
  cache.delete(filePath)
}
