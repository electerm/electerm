/**
 * "is this a .vv connection file?" — shared by the command line and the OS
 * file-open path in the main process.
 *
 * Pure CJS with no electron import on purpose, so `node --test` can require it.
 * The renderer has its own ESM twin (src/client/common/vv-to-tab.js isVvFile)
 * because a module cannot be shared across the two halves of the app; the two
 * are kept honest by src/test/unit-ci/vv-file.spec.js, which asserts they agree
 * on the same corpus.
 *
 * `://` is excluded so a deep link that happens to end in .vv
 * (spice://host/console.vv) is not mistaken for a path -- deep links have their
 * own parser, and treating one as a path would read the network off the disk.
 */
const path = require('path')

const VV_EXT = /\.vv$/i
const URL_LIKE = /:\/\//

/**
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
 * Resolve a single argument to an absolute .vv path.
 *
 * Absolute because this process owns the cwd the user typed the path in -- by
 * the time the renderer reads it, that cwd is gone.
 *
 * @param {string} value
 * @returns {string|null}
 */
function resolveVvFile (value) {
  if (!isVvFile(value)) {
    return null
  }
  return path.resolve(value.trim())
}

/**
 * Find a .vv file among argv.
 *
 * Scanned out of the raw argv rather than taken from commander's positional
 * args, because commander slices argv differently for `electron .`
 * (process.defaultApp is true, so it drops two entries) and for a packaged
 * build (it drops one). An argument ending in .vv means the same thing either
 * way, and going through argv keeps this working in both without touching how
 * `electerm user@host` is parsed.
 *
 * @param {string[]} argv
 * @returns {string|null} absolute path, or null when no .vv was given
 */
function findVvFile (argv) {
  if (!Array.isArray(argv)) {
    return null
  }
  const hit = argv.find(arg => isVvFile(arg) && !arg.trim().startsWith('-'))
  return hit ? path.resolve(hit.trim()) : null
}

module.exports = {
  isVvFile,
  resolveVvFile,
  findVvFile,
  VV_EXT,
  URL_LIKE
}
