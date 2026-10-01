/**
 * Join a base directory with a filename that may come from an untrusted source
 * (a remote server's directory listing, a drag payload, ...) and keep the
 * result inside the base.
 *
 * The sanitize step is load-bearing, not cosmetic. electerm's `resolve` does no
 * normalisation and three of its branches discard the base outright: a leading
 * `/`, a UNC `\\`, and a Windows drive prefix. The drive branch is the easy one
 * to miss because it needs no separator at all — `resolve('/uploads', 'C:x')`
 * returns `'C:x'`. Stripping `:` and the separators removes every one of those
 * branches, leaving only the "append to base" path.
 *
 * @param {String} base directory the name must stay inside
 * @param {String} name untrusted file name
 * @return {String} base + separator + a safe name, always inside `base`
 */

import resolve from './resolve.js'
import sanitizeFilename from './sanitize-filename.js'

// A single path component: no separator, and not `.` or `..`.
const SINGLE_COMPONENT = /^(?!\.\.?$)[^/\\]+$/

export default function safeJoin (base, name) {
  const safeName = sanitizeFilename(name)
  // sanitizeFilename already satisfies this, so the fallback is unreachable in
  // practice: it is here so that a future change to its character list degrades
  // to a neutral name instead of escaping the base. Deliberately not a throw —
  // a bad entry in a remote listing must not take down the whole drop. It also
  // stays silent on purpose: no legitimate name contains a separator, so the
  // only names that can reach the fallback are hostile ones.
  return resolve(base, SINGLE_COMPONENT.test(safeName) ? safeName : 'unnamed')
}
