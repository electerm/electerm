/**
 * file info related functions
 */

import { nanoid as generate } from 'nanoid/non-secure'
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
    ext: arr[len - 1]
  }
}

export const getFolderFromFilePath = filePath => {
  const { sep } = window.pre
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
    name
  }
}

export const getLocalFileInfo = async (filePath) => {
  try {
    const statr = await fs.statAsync(filePath)
    const stat = await fs.lstatAsync(filePath)
    return {
      size: stat.size,
      accessTime: stat.atime,
      modifyTime: stat.mtime,
      mode: stat.mode,
      owner: stat.uid,
      group: stat.gid,
      type: 'local',
      ...getFolderFromFilePath(filePath),
      id: generate(),
      isDirectory: statr.isDirectory,
      isSymbolicLink: stat.isSymbolicLink
    }
  } catch (e) {
    log.debug(e)
    return null
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
    ...getFolderFromFilePath(filePath),
    id: generate(),
    isDirectory: stat.isDirectory
  }
}
