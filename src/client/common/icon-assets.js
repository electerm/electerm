/**
 * Turn a stored icon value into something an <img> can show.
 *
 * Built-in icons are static files served under /icons, so they need nothing
 * more than a URL. A local file has to be read through the app (`window.fs`),
 * which works in the desktop app and in the web build alike, and the result is
 * cached per path because a bookmark list can have dozens of rows and re-render
 * on every scroll frame.
 */

import fs from './fs'
import { iconMimeType } from './icon-value'

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
    '/icons/'
  return `${base}${name}.svg`
}

/**
 * Absolute local icon file as a data URL. Resolves to '' when the file cannot
 * be read, so the caller falls back to the colour.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export function loadFileIcon (filePath) {
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
