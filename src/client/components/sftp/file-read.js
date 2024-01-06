/**
 * file info related functions
 */

import generate from '../../common/uid'
import fs from '../../common/fs'
import { isWin, typeMap } from '../../common/constants'
import resolve from '../../common/resolve'

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
      ...getFolderFromFilePath(filePath, false),
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
    ...getFolderFromFilePath(filePath, true),
    id: generate(),
    isDirectory: stat.isDirectory
  }
}

export async function checkFolderSize (props, f) {
  const pth = resolve(f.path, f.name)
  const func = f.type === typeMap.remote
    ? props.sftp
    : window.fs
  const {
    size,
    count
  } = await func.getFolderSize(pth)
    .catch(err => {
      console.log('get folder size fail', err)
      return { size: 0, count: 0 }
    })
  if (count === 0) {
    return true
  }
  if (size >= 600) {
    return false
  }
  if (size / count >= 100) {
    return false
  }
  return true
}
