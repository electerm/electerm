/**
 * file info related functions
 */

import {generate} from 'shortid'

const {getGlobal, _require} = window
const fs = getGlobal('fs')

export const getFolderFromFilePath = filePath => {
  let {sep} = _require('path')
  let arr = filePath.split(sep)
  let len = arr.length
  return {
    path: arr.slice(0, len - 1).join(sep),
    name: arr[len - 1]
  }
}

export const getLocalFileInfo = async (filePath) => {
  let stat = await fs.statAsync(filePath)
  return {
    size: stat.size,
    accessTime: stat.atime,
    modifyTime: stat.mtime,
    mode: stat.mode,
    type: 'local',
    ...getFolderFromFilePath(filePath),
    id: generate(),
    isDirectory: stat.isDirectory()
  }
}

export const getRemoteFileInfo = async (sftp, filePath) => {
  let stat = await sftp.stat(filePath)
  return {
    //size: stat.size,
    //accessTime: stat.atime,
    //modifyTime: stat.mtime,
    //mode: stat.mode,
    type: 'remote',
    ...getFolderFromFilePath(filePath),
    id: generate(),
    isDirectory: stat.isDirectory()
  }
}
