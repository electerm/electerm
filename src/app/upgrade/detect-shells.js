/**
 * Detect the shells that actually exist on this machine.
 *
 * Used to seed the default local terminal bookmarks of a brand new install,
 * so a fresh bookmark list never contains an entry that fails to open.
 *
 * How an exec value is turned into a process (see app/server/session-local.js):
 * - Windows: the value is resolved against `process.env.windir`, so built in
 *   shells are stored as windir relative paths ('System32/cmd.exe') and
 *   everything else must be an absolute path.
 * - macOS/Linux: the value is spawned as-is, so a bare command name is
 *   preferred. It keeps the bookmark valid across machines, where the same
 *   shell can live in different places (/opt/homebrew/bin/fish vs
 *   /usr/local/bin/fish).
 */

const fs = require('fs')
const path = require('path')

const { platform } = process
const isWin = platform.startsWith('win')
const isMac = platform === 'darwin'

const winDir = process.env.windir || process.env.SystemRoot || 'C:\\Windows'

// Directories a GUI launched app often misses in PATH: a macOS .app bundle
// inherits launchd's minimal PATH, so homebrew / /usr/local shells would be
// invisible otherwise. Same idea for Linux desktop entries and snap.
const extraDirs = isMac
  ? ['/opt/homebrew/bin', '/usr/local/bin']
  : isWin
    ? []
    : ['/usr/local/bin', '/snap/bin', '/usr/bin']

function canExec (p) {
  try {
    fs.accessSync(p, fs.constants.X_OK)
    return true
  } catch (e) {
    return false
  }
}

function pathDirs () {
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean)
}

const pathExts = isWin
  ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  : ['']

function findInPath (name) {
  const names = isWin && !/\.[a-z0-9]+$/i.test(name)
    ? pathExts.map(ext => name + ext)
    : [name]
  for (const dir of pathDirs()) {
    for (const n of names) {
      const p = path.join(dir, n)
      if (canExec(p)) {
        return p
      }
    }
  }
  return ''
}

function findInExtraDirs (name) {
  for (const dir of extraDirs) {
    const p = path.join(dir, name)
    if (canExec(p)) {
      return p
    }
  }
  return ''
}

/**
 * Resolve a bare shell name into a bookmark exec value
 * @param {string} name e.g. 'zsh', 'pwsh'
 * @return {string} '' when the shell is not installed
 */
function resolveExec (name) {
  const found = findInPath(name)
  if (found) {
    // Windows needs a full path, POSIX is happier with the bare name
    return isWin ? found : name
  }
  return isWin ? '' : findInExtraDirs(name)
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
  return canExec(abs) ? rel : ''
}

/**
 * First existing file among the given absolute candidates
 * @param {string[]} paths
 * @return {string} '' when none exists
 */
function firstExisting (paths) {
  for (const p of paths) {
    if (p && canExec(p)) {
      return p
    }
  }
  return ''
}

module.exports = {
  isWin,
  isMac,
  resolveExec,
  resolveWinDirExec,
  firstExisting
}
