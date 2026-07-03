/**
 * Sanitize a filename for cross-platform file transfers.
 *
 * When transferring files between different OS (Linux <-> Windows <-> macOS),
 * filenames may contain characters that are illegal on the destination OS.
 * Windows is the most restrictive common platform, so we use its rules as
 * the baseline for maximum compatibility.
 *
 * Rules applied:
 * - Remove control characters (0x00-0x1F)
 * - Replace reserved characters: < > : " / \ | ? * with _
 * - Strip trailing dots and spaces (Windows restriction: "file.", "file ")
 * - Strip leading spaces only (NOT leading dots — they mean hidden file)
 * - Reject reserved Windows device names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
 * - Limit filename length to 255 bytes (common filesystem limit)
 * - Fallback to 'unnamed' if result is empty
 */

// Characters illegal on Windows (and problematic on many systems)
// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARS = /[<>:"/\\|?\x00-\x1f]/g

// Trailing dots and spaces = problematic on Windows (e.g. "file." → "file")
// Leading dots are PRESERVED — they mean "hidden file" on Unix and work on modern Windows
const TRAILING_DOTS_SPACES = /[.\s]+$/g

// Leading spaces only — Windows can't handle filenames starting with space
const LEADING_SPACES = /^\s+/

// Reserved Windows device names (case-insensitive)
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i

const MAX_FILENAME_LENGTH = 255

const REPLACEMENT_CHAR = '_'

module.exports = function sanitizeFilename (name) {
  if (!name || typeof name !== 'string') {
    return 'unnamed'
  }

  let safe = name
    // Replace illegal characters
    .replace(ILLEGAL_CHARS, REPLACEMENT_CHAR)
    // Strip trailing dots and spaces (Windows restriction)
    .replace(TRAILING_DOTS_SPACES, '')
    // Strip leading spaces only (not dots — they mean hidden file)
    .replace(LEADING_SPACES, '')

  // Handle reserved Windows device names by appending underscore
  if (RESERVED_NAMES.test(safe)) {
    safe = safe + REPLACEMENT_CHAR
  }

  // Truncate to max length
  if (safe.length > MAX_FILENAME_LENGTH) {
    const ext = safe.lastIndexOf('.')
    if (ext > 0) {
      // Preserve extension when truncating
      const extension = safe.slice(ext)
      safe = safe.slice(0, MAX_FILENAME_LENGTH - extension.length) + extension
    } else {
      safe = safe.slice(0, MAX_FILENAME_LENGTH)
    }
  }

  // Fallback for empty result
  if (!safe) {
    return 'unnamed'
  }

  return safe
}
