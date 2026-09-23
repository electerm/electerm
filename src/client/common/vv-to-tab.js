/**
 * .vv connection file -> electerm Spice tab options
 *
 * Kept apart from parse-vv.js on purpose: parse-vv.js knows the file format
 * and nothing about electerm, this module knows electerm's Spice tab shape and
 * nothing about the format. Staying free of window/api access is what makes it
 * unit-testable, and it is shared by both entry points for a .vv file --
 * the bookmark form's "Load .vv file" button and a file handed to electerm
 * from outside (`electerm /path/to/console.vv`).
 *
 * Deliberately imports nothing: constants.js pulls in the logo .png files and
 * `window`, which would make this unimportable under `node --test`.
 * parse-quick-connect.js spells the type out for the same reason.
 */

/**
 * The `spice` value of terminalSpiceType (src/client/common/constants.js).
 * A .vv file is a virt-viewer file, and the only type this client implements
 * is spice -- parse-vv.js rejects every other `type=` already.
 */
const SPICE_TYPE = 'spice'

/**
 * Mirrors the Spice defaults in components/bookmark-form/config/spice.js
 * initValues(), so a .vv that omits them behaves exactly like a Spice bookmark
 * added by hand.
 */
const SPICE_DEFAULTS = {
  viewOnly: false,
  scaleViewport: true
}

/**
 * Port used when the file names a host but no port at all. Matches
 * DEFAULT_PORTS.spice in parse-quick-connect.js.
 */
const DEFAULT_SPICE_PORT = 5900

const VV_EXT = /\.vv$/i
const URL_LIKE = /:\/\//

/**
 * Does this look like a .vv file path?
 *
 * A suffix test rather than an exists()/stat() call on purpose: this is asked
 * synchronously while scanning a command line, and the read that follows
 * reports a missing file far better than a bare boolean could.
 *
 * `://` is excluded so a deep link that happens to end in .vv
 * (spice://host/console.vv) is not mistaken for a path -- deep links have their
 * own parser and would otherwise be read off the disk.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isVvFile (value) {
  if (typeof value !== 'string') {
    return false
  }
  const text = value.trim()
  return VV_EXT.test(text) && !URL_LIKE.test(text)
}

/**
 * Last path segment, for a tab title when the file carries no `title` key.
 * Done by hand because the renderer has no path module.
 *
 * @param {string} filePath
 * @returns {string}
 */
function basename (filePath) {
  return String(filePath).split(/[/\\]/).pop() || String(filePath)
}

/**
 * Build tab options from a parse result.
 *
 * Only keys the file actually provided are set. An absent `ca` or `hostSubject`
 * must stay absent rather than become an empty string, because the session code
 * reads "no ca" as "do not verify against a pinned CA" -- an empty string there
 * would mean "pin nothing", which fails every handshake.
 *
 * @param {Object} parsed - result of parseVv()
 * @param {Object} [options] - { filePath } plus any tab overrides
 * @returns {Object} options for store.addTab()
 */
function vvToTab (parsed, options = {}) {
  const { filePath, ...extra } = options
  const f = parsed.fields
  const tab = {
    type: SPICE_TYPE,
    host: f.host,
    port: f.port || DEFAULT_SPICE_PORT,
    tls: !!f.tls,
    ...SPICE_DEFAULTS
  }
  const optional = {
    ca: f.ca,
    hostSubject: f.hostSubject,
    password: f.password,
    proxy: f.proxy,
    title: f.title || (filePath ? basename(filePath) : '')
  }
  Object.keys(optional).forEach(key => {
    if (optional[key]) {
      tab[key] = optional[key]
    }
  })
  return { ...tab, ...extra }
}

export {
  isVvFile,
  SPICE_TYPE,
  vvToTab,
  basename,
  VV_EXT,
  DEFAULT_SPICE_PORT,
  SPICE_DEFAULTS
}
