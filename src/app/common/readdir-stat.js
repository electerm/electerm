/**
 * Directory listing with per-entry stat info, in one pass.
 *
 * The file manager needs `isDirectory` from `stat` (which follows symlinks) and
 * size/mode/time from `lstat` (which describes the entry itself). Doing that
 * pair per entry from the renderer meant two websocket round trips per
 * directory entry -- a folder with a few thousand entries cost ~10000 hops
 * through the worker (see #4663). This module keeps the syscalls on the node
 * side, so the whole listing is one round trip.
 *
 * Kept free of runtime-constants/log so it can be unit tested with plain node.
 */

const fss = require('fs/promises')
const path = require('path')

const IS_WIN = process.platform === 'win32'
const ROOT_PATH = '/'

/**
 * `C:` alone means "current dir of C:" to most fs calls, so add the separator.
 */
function normalizeDirPath (dirPath) {
  if (IS_WIN && /^\w+:$/.test(dirPath)) {
    return dirPath + '\\'
  }
  return dirPath
}

/**
 * Path of one directory entry. On the Windows root listing the "names" are
 * drives (`C:`) or WSL distros (`\\wsl.localhost\Ubuntu`), not children.
 */
function joinEntryPath (dirPath, name) {
  if (IS_WIN && dirPath === ROOT_PATH) {
    return name.endsWith('\\') ? name : name + '\\'
  }
  return path.join(normalizeDirPath(dirPath), name)
}

async function statEntry (dirPath, name) {
  const p = joinEntryPath(dirPath, name)
  let st
  try {
    st = await fss.lstat(p)
  } catch (e) {
    // vanished between readdir and lstat
    return null
  }
  let isDirectory = st.isDirectory()
  if (st.isSymbolicLink()) {
    try {
      isDirectory = (await fss.stat(p)).isDirectory()
    } catch (e) {
      // dangling symlink: the list used to drop these entries, keep doing that
      return null
    }
  }
  return {
    name,
    size: st.size,
    atimeMs: st.atimeMs,
    atime: st.atime,
    mtimeMs: st.mtimeMs,
    mtime: st.mtime,
    mode: st.mode,
    uid: st.uid,
    gid: st.gid,
    isDirectory,
    isSymbolicLink: st.isSymbolicLink()
  }
}

/**
 * @param {string} dirPath directory the names came from
 * @param {string[]} names entries of `dirPath`
 * @returns {Promise<object[]>} one object per statable entry, in `names` order
 */
async function readdirStat (dirPath, names) {
  const list = await Promise.all(
    names.map(name => statEntry(dirPath, name))
  )
  return list.filter(Boolean)
}

module.exports = {
  readdirStat,
  normalizeDirPath,
  joinEntryPath,
  ROOT_PATH
}
