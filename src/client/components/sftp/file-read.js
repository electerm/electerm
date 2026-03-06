/**
 * file info related functions
 */

import generate from '../../common/uid'
import fs from '../../common/fs'
import { isWin } from '../../common/constants'

export const getFileExt = fileName => {
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
  const path = isWinDisk
    ? '/'
    : arr.slice(0, len - 1).join(sep)
  const name = isWinDisk
    ? filePath.replace(sep, '')
    : arr[len - 1]

  return {
    path,
    name,
    ...getFileExt(name)
  }
}

export const getLocalFileInfo = async (filePath) => {
  const statr = await fs.statAsync(filePath)
  const stat = await fs.lstatAsync(filePath)
  return {
    size: stat.size,
    accessTime: stat.atime || stat.atimeMs,
    modifyTime: stat.mtime || stat.mtimeMs,
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
