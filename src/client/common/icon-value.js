/**
 * Icon value of a bookmark or a bookmark group.
 *
 * Only three shapes are stored in the `icon` field, everything else is treated
 * as "no icon" and the colour is shown instead:
 *
 *   ''                       no icon
 *   'icon:ubuntu'            built-in icon shipped with electerm-icons
 *   '/home/u/logo.svg'       local file, read on demand by icon-assets.js
 *
 * A remote URL is never stored. The picker downloads it into
 * `<data dir>/icons` first (src/app/lib/icon-download.js), so rendering a
 * bookmark never makes the client reach a host the bookmark pointed at. That
 * matters because bookmarks are synced, imported from files and written by
 * MCP/AI callers, i.e. they are not trusted input.
 */

export const builtinIconPrefix = 'icon:'

// electerm-icons names, e.g. `rocky-linux`. Keep the check local: the list of
// built-in icons can grow in a newer package without breaking old values.
const builtinIconName = /^[a-z0-9][a-z0-9-]*$/

// An extension picks the mime type of a local file. Kept to what browsers can
// render in an <img>; anything else falls back to svg, the icon format we
// expect people to use (and the one an unknown extension is most likely to be).
const iconMimeTypes = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif'
}

export const iconFileExtensions = [
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

function isWindowsAbsPath (value) {
  return /^[a-zA-Z]:[\\/]/.test(value)
}

function isUncPath (value) {
  return value.startsWith('\\\\')
}

/**
 * Parse a stored icon value into what has to be rendered.
 * @param {*} value
 * @returns {{type: 'builtin', name: string}|{type: 'file', path: string}|null}
 */
export function parseIcon (value) {
  if (typeof value !== 'string') {
    return null
  }
  const v = value.trim()
  if (!v) {
    return null
  }
  if (v.startsWith(builtinIconPrefix)) {
    const name = v.slice(builtinIconPrefix.length)
    return builtinIconName.test(name)
      ? { type: 'builtin', name }
      : null
  }
  // `//` is a protocol-relative URL in a bookmark file, never a path we wrote
  // (a POSIX path can technically start with two slashes, no one stores icons
  // that way)
  const isPosixPath = v.startsWith('/') && !v.startsWith('//')
  if (isPosixPath || isWindowsAbsPath(v) || isUncPath(v)) {
    return { type: 'file', path: v }
  }
  return null
}

/**
 * Store a built-in icon name as an icon value.
 * @param {string} name
 */
export function builtinIconValue (name) {
  return builtinIconPrefix + name
}

/**
 * Canonical form of an icon value: trimmed, or '' when it cannot be rendered.
 * Used on every write (form submit, MCP, import) so a hand-edited or synced
 * value cannot smuggle something else into the field.
 * @param {*} value
 */
export function normalizeIcon (value) {
  const parsed = parseIcon(value)
  if (!parsed) {
    return ''
  }
  return parsed.type === 'builtin'
    ? builtinIconValue(parsed.name)
    : parsed.path
}

/**
 * Mime type for a local icon file, by extension.
 * @param {string} filePath
 */
export function iconMimeType (filePath) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(String(filePath || '').trim())
  const ext = match ? match[1].toLowerCase() : ''
  return iconMimeTypes[ext] || iconMimeTypes.svg
}
