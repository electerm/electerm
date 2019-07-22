/**
 * file info related functions
 */

import { generate } from 'shortid'
import fs from '../../common/fs'

const { _require } = window

export const getFolderFromFilePath = filePath => {
  const { sep } = _require('path')
  const arr = filePath.split(sep)
  const len = arr.length
  return {
    path: arr.slice(0, len - 1).join(sep),
    name: arr[len - 1]
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
    // size: stat.size,
    // accessTime: stat.atime,
    // modifyTime: stat.mtime,
    mode: stat.mode,
    type: 'remote',
    ...getFolderFromFilePath(filePath),
    id: generate(),
    isDirectory: stat.isDirectory
  }
}
