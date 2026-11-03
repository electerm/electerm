/**
 * file info related functions
 */

import generate from '../../common/uid'
import { isWin } from '../../common/constants'

export const getFileExt = fileName => {
  if (/^\\\\(?:wsl\$|wsl\.localhost)\\/.test(fileName)) {
    return {
      base: fileName,
      ext: ''
    }
  }
  const sep = '.'
  const arr = fileName.split(sep)
  const len = arr.length
  if (len === 1) {
    return {
      base: fileName,
      ext: ''
    }
  }
  return {
    base: arr.slice(0, len - 1).join(sep),
    ext: arr[len - 1] || ''
  }
}

const modeDirectoryMask = 0o170000
const modeDirectoryValue = 0o040000

const toIsDirectory = (stat) => {
  if (!stat) {
    return false
  }

  if (typeof stat.isDirectory === 'function') {
    return stat.isDirectory()
  }

  if (typeof stat.isDirectory === 'boolean') {
    return stat.isDirectory
  }

  if (typeof stat.type === 'string') {
    return stat.type === 'd'
  }

  if (typeof stat.type === 'number') {
    return stat.type === 2
  }

  if (typeof stat.mode === 'number') {
    return (stat.mode & modeDirectoryMask) === modeDirectoryValue
  }

  return false
}

const toIsSymbolicLink = (stat) => {
  if (!stat) {
    return false
  }

  if (typeof stat.isSymbolicLink === 'function') {
    return stat.isSymbolicLink()
  }

  if (typeof stat.isSymbolicLink === 'boolean') {
    return stat.isSymbolicLink
  }

  if (typeof stat.type === 'string') {
    return stat.type === 'l'
  }

  if (typeof stat.type === 'number') {
    return stat.type === 3
  }

  return false
}

export const getFolderFromFilePath = (filePath, isRemote) => {
  const sep = isRemote ? '/' : window.pre.sep
  const arr = filePath.split(sep)
  const len = arr.length
  const isWinDisk = isWin && filePath.endsWith(sep)
  const isWslRoot = isWin && /^\\\\(?:wsl\$|wsl\.localhost)\\[^\\]+$/.test(filePath.replace(/\\$/, ''))
  const path = (isWinDisk || isWslRoot)
    ? '/'
    : arr.slice(0, len - 1).join(sep)
  const name = isWinDisk
    ? filePath.replace(sep, '')
    : isWslRoot
      ? filePath
      : arr[len - 1]

  return {
    path,
    name,
    ...getFileExt(name)
  }
}

function toMs (ms, date) {
  const n = Number(ms)
  if (Number.isFinite(n)) return n
  const d = Number(date)
  return Number.isFinite(d) ? d : 0
}

const toFileInfo = (filePath, statr, stat) => {
  return {
    size: stat.size,
    accessTime: toMs(stat.atimeMs, stat.atime),
    modifyTime: toMs(stat.mtimeMs, stat.mtime),
    mode: stat.mode,
    owner: stat.uid,
    group: stat.gid,
    type: 'local',
    ...getFolderFromFilePath(filePath, false),
    id: generate(),
    isDirectory: toIsDirectory(statr),
    isSymbolicLink: toIsSymbolicLink(stat)
  }
}

export const getLocalFileInfo = async (filePath) => {
  // stat follows symlinks (gives the real folder/file type of the target),
  // lstat describes the entry itself (size/mode/time of the link). Two
  // independent calls, so do not pay two round trips in a row for them.
  const [statr, stat] = await Promise.all([
    window.fs.statAsync(filePath),
    window.fs.lstatAsync(filePath)
  ])
  return toFileInfo(filePath, statr, stat)
}

// Same shape, built from the merged entry object returned by
// `fs.readdirStatAsync` (one round trip for the whole directory).
export const getLocalFileInfoFromStat = (filePath, stat) => {
  return toFileInfo(filePath, stat, stat)
}

export const getRemoteFileInfo = async (sftp, filePath) => {
  const stat = await sftp.stat(filePath)
  return {
    size: stat.size,
    accessTime: stat.atime,
    modifyTime: stat.mtime,
    mode: stat.mode,
    group: stat.gid,
    owner: stat.uid,
    type: 'remote',
    ...getFolderFromFilePath(filePath, true),
    id: generate(),
    isDirectory: toIsDirectory(stat)
  }
}
