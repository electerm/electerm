/**
 * Detect the shells that actually exist on this machine.
 *
 * Used to seed the default local terminal bookmarks of a brand new install,
 * so a fresh bookmark list never contains an entry that fails to open.
 *
 * Every shell is probed at a fixed path, one accessSync each: no PATH is
 * walked, because this data is computed on every app start (see
 * db-defaults.js) and a shell installed somewhere else is one manual bookmark
 * away. The old PATH scan also cost up to PATHEXT probes per directory on
 * Windows, where a stale mapped or UNC directory on PATH can block for a while.
 *
 * How an exec value is turned into a process (see app/server/session-local.js):
 * - Windows: the value is resolved against `process.env.windir`, so built in
 *   shells are stored as windir relative paths ('System32/cmd.exe') and
 *   everything else is an absolute path.
 * - macOS/Linux: the value is spawned as-is, so it has to be absolute too.
 */

const fs = require('fs')
const path = require('path')

const { platform } = process
const isWin = platform.startsWith('win')
const isMac = platform === 'darwin'

const winDir = process.env.windir || process.env.SystemRoot || 'C:\\Windows'

/**
 * Whether a shell is installed at this exact path
 * @param {string} p absolute path
 * @return {boolean}
 */
function exists (p) {
  try {
    fs.accessSync(p, fs.constants.X_OK)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Resolve a shell shipped inside the Windows directory
 * @param {string} rel windir relative path, e.g. 'System32/cmd.exe'
 * @return {string} '' when the file is missing
 */
function resolveWinDirExec (rel) {
  if (!isWin) {
    return ''
  }
  const abs = path.join(winDir, ...rel.split('/'))
  return exists(abs) ? rel : ''
}

module.exports = {
  isWin,
  isMac,
  exists,
  resolveWinDirExec
}
