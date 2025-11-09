/**
 * Common utilities for handling file drops
 */

import { getFolderFromFilePath } from '../components/sftp/file-read'
import { typeMap } from './constants'

/**
 * Safely get file path from dropped file
 * @param {File} file - File object from drop event
 * @returns {string} - File path
 */
export const getFilePath = (file) => {
  if (file.path) {
    return file.path
  }
  // Try the official Electron 32+ method first if available
  if (window.api && window.api.getPathForFile) {
    return window.api.getPathForFile(file)
  }
  return file.name
}

/**
 * Process dropped files and return file list
 * @param {DataTransfer} dataTransfer - DataTransfer object from drop event
 * @returns {Array} - Array of file objects
 */
export const getDropFileList = (dataTransfer) => {
  const fromFile = dataTransfer.getData('fromFile')
  if (fromFile) {
    return [JSON.parse(fromFile)]
  }

  const { files } = dataTransfer
  const res = []
  for (let i = 0, len = files.length; i < len; i++) {
    const item = files[i]
    if (!item) {
      continue
    }

    const filePath = getFilePath(item)
    const isRemote = false
    const fileObj = getFolderFromFilePath(filePath, isRemote)
    res.push({
      ...fileObj,
      type: typeMap.local
    })
  }
  return res
}

/**
 * Check if filename contains unsafe characters
 * @param {string} filename - Filename to check
 * @returns {boolean} - True if unsafe
 */
export const isUnsafeFilename = (filename) => {
  return /["'\n\r]/.test(filename)
}
