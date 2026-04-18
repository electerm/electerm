/**
 * RDP File Transfer Module
 * Handles file upload/download between local and remote desktop via IronRDP CLIPRDR channel
 */

import fs from '../../common/fs'
import { getLocalFileInfo } from '../sftp/file-read'

const LOG_PREFIX = '[RDP-FILE-TRANSFER]'

// File open flags (POSIX standard values)
const O_RDONLY = 0
const O_WRONLY = 1
const O_CREAT = 64
const O_TRUNC = 512

export function createFileLogger () {
  return (msg, type = 'info') => {
    const timestamp = new Date().toISOString()
    console.log(`${LOG_PREFIX}[${type}][${timestamp}] ${msg}`)
  }
}

export class FileTransferManager {
  constructor (getSession, log, onUploadStateChange, onUploadComplete, onDownloadComplete) {
    this.getSession = getSession
    this.log = log
    this.uploadedFiles = new Map()
    this.pendingDownloads = new Map()
    this.streamToFileInfo = new Map()
    this.hasRemoteFiles = false
    this.onStateChange = null
    this.onUploadStateChange = onUploadStateChange
    this.onUploadComplete = onUploadComplete
    this.onDownloadComplete = onDownloadComplete
    this.uploadTimeout = null
  }

  setStateChangeCallback (callback) {
    this.onStateChange = callback
  }

  setUploadInProgress (inProgress) {
    if (this.onUploadStateChange) {
      this.onUploadStateChange(inProgress)
    }
  }

  notifyStateChange () {
    if (this.onStateChange) {
      this.onStateChange({
        hasRemoteFiles: this.hasRemoteFiles,
        pendingDownloads: this.pendingDownloads,
        uploadedFiles: this.uploadedFiles
      })
    }
  }

  createExtensions () {
    const { Extension } = window.ironRdp
    const extensions = []

    extensions.push(this.createFilesAvailableCallback(Extension))
    extensions.push(this.createFileContentsRequestCallback(Extension))
    extensions.push(this.createFileContentsResponseCallback(Extension))
    extensions.push(this.createLockCallback(Extension))
    extensions.push(this.createUnlockCallback(Extension))
    extensions.push(this.createLocksExpiredCallback(Extension))

    return extensions
  }

  createFilesAvailableCallback (Extension) {
    return new Extension('files_available_callback', (files, clipDataId) => {
      this.pendingDownloads.clear()
      this.streamToFileInfo.clear()

      if (files && files.length > 0) {
        files.forEach((f, i) => {
          this.pendingDownloads.set(i, { ...f, clipDataId })
        })
      }

      this.hasRemoteFiles = files && files.length > 0
      this.notifyStateChange()
    })
  }

  createFileContentsRequestCallback (Extension) {
    return new Extension('file_contents_request_callback', async (request) => {
      const file = this.uploadedFiles.get(request.index)
      if (!file) {
        this.getSession().invokeExtension(new Extension('submit_file_contents', {
          stream_id: request.streamId,
          is_error: true,
          data: new Uint8Array(0)
        }))
        return
      }

      try {
        if (request.flags & 0x00000001) {
          const sizeBytes = new Uint8Array(8)
          const view = new DataView(sizeBytes.buffer)
          view.setBigUint64(0, BigInt(file.size), true)
          this.getSession().invokeExtension(new Extension('submit_file_contents', {
            stream_id: request.streamId,
            is_error: false,
            data: sizeBytes
          }))
        } else if (request.flags & 0x00000002) {
          const start = request.position
          const length = request.size

          const fd = await new Promise((resolve, reject) => {
            fs.open(file.filePath, O_RDONLY, (err, fd) => {
              if (err) reject(err)
              else resolve(fd)
            })
          })

          const buffer = new Uint8Array(length)
          const { bytesRead, buffer: readBuffer } = await new Promise((resolve, reject) => {
            fs.read(fd, buffer, 0, length, start, (err, bytesRead, buffer) => {
              if (err) reject(err)
              else resolve({ bytesRead, buffer })
            })
          })

          await new Promise((resolve, reject) => {
            fs.close(fd, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })

          const data = new Uint8Array(readBuffer.buffer, readBuffer.byteOffset, bytesRead)
          this.getSession().invokeExtension(new Extension('submit_file_contents', {
            stream_id: request.streamId,
            is_error: false,
            data
          }))
          this.setUploadInProgress(false)
          if (this.onUploadComplete) {
            this.onUploadComplete()
          }
        }
      } catch (e) {
        this.log(`Failed to read file: ${e.message}`, 'error')
        this.getSession().invokeExtension(new Extension('submit_file_contents', {
          stream_id: request.streamId,
          is_error: true,
          data: new Uint8Array(0)
        }))
        this.setUploadInProgress(false)
        if (this.onUploadComplete) {
          this.onUploadComplete()
        }
      }
    })
  }

  createFileContentsResponseCallback (Extension) {
    return new Extension('file_contents_response_callback', (response) => {
      const streamId = response.streamId

      const fileInfo = this.streamToFileInfo.get(streamId)
      if (!fileInfo) {
        return
      }

      if (response.isError) {
        this.streamToFileInfo.delete(streamId)
        return
      }

      if (!fileInfo._chunks) {
        fileInfo._chunks = []
        fileInfo._totalSize = 0
      }

      if (response.data.length === 8 && !fileInfo._sizeReceived) {
        const view = new DataView(response.data.buffer)
        const fileSize = Number(view.getBigUint64(0, true))
        fileInfo._sizeReceived = true
        fileInfo._expectedSize = fileSize

        const dataStreamId = streamId + 1000
        this.streamToFileInfo.set(dataStreamId, fileInfo)

        const requestFileContentsExt = new Extension('request_file_contents', {
          stream_id: dataStreamId,
          file_index: fileInfo._fileIndex,
          flags: 0x00000002,
          position: 0,
          size: fileSize,
          clip_data_id: fileInfo.clipDataId
        })
        this.getSession().invokeExtension(requestFileContentsExt)
      } else {
        fileInfo._chunks.push(new Uint8Array(response.data))
        fileInfo._totalSize += response.data.length

        if (fileInfo._totalSize >= fileInfo._expectedSize) {
          this.handleFileDownload(fileInfo)
          this.streamToFileInfo.delete(streamId)
        }
      }
    })
  }

  createLockCallback (Extension) {
    return new Extension('lock_callback', (dataId) => {
      this.log(`Clipboard locked: dataId=${dataId}`, 'info')
    })
  }

  createUnlockCallback (Extension) {
    return new Extension('unlock_callback', (dataId) => {
      this.log(`Clipboard unlocked: dataId=${dataId}`, 'info')
    })
  }

  createLocksExpiredCallback (Extension) {
    return new Extension('locks_expired_callback', (clipDataIds) => {
      this.log(`Clipboard locks expired: ${clipDataIds.length} lock(s)`, 'warn')
    })
  }

  async handleFileDownload (fileInfo) {
    try {
      const savePath = await window.api.openDialog({
        title: `Save ${fileInfo.name}`,
        message: `Choose where to save ${fileInfo.name}`,
        properties: ['openDirectory', 'createDirectory']
      }).catch((err) => {
        this.log(`Save dialog error: ${err.message}`, 'error')
        return false
      })

      if (!savePath || !savePath.length) {
        this.log('Download cancelled by user', 'info')
        return
      }

      const fullPath = `${savePath[0]}/${fileInfo.name}`

      const fd = await new Promise((resolve, reject) => {
        fs.open(fullPath, O_WRONLY | O_CREAT | O_TRUNC, (err, fd) => {
          if (err) reject(err)
          else resolve(fd)
        })
      })

      const blob = new Blob(fileInfo._chunks)
      const arrayBuffer = await blob.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)

      await new Promise((resolve, reject) => {
        fs.write(fd, data, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      await new Promise((resolve, reject) => {
        fs.close(fd, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      this.log(`Downloaded ${fileInfo.name} (${this.formatFileSize(fileInfo._totalSize)}) to ${fullPath}`, 'success')
      if (this.onDownloadComplete) {
        this.onDownloadComplete(fullPath, fileInfo.name, fileInfo._totalSize)
      }
    } catch (e) {
      this.log(`Failed to save file: ${e.message}`, 'error')
    }
  }

  async uploadFiles (files) {
    const sess = this.getSession()
    if (!sess) {
      this.log('File transfer not available - no session', 'error')
      return
    }

    this.setUploadInProgress(true)

    try {
      const fileDescriptors = files.map((file, index) => {
        this.uploadedFiles.set(index, file)
        return {
          name: file.name,
          size: file.size,
          lastModified: file.modifyTime || Date.now()
        }
      })

      const initiateFileCopyExt = new window.ironRdp.Extension('initiate_file_copy', fileDescriptors)
      sess.invokeExtension(initiateFileCopyExt)
    } catch (err) {
      this.log(`Failed to initiate file copy: ${err.message}`, 'error')
      this.setUploadInProgress(false)
    }
  }

  async uploadFromPaths (filePaths) {
    const fileInfos = []

    for (const filePath of filePaths) {
      try {
        const stat = await getLocalFileInfo(filePath)
        if (stat && (stat.isFile || stat.isDirectory === false)) {
          fileInfos.push({ ...stat, filePath, path: filePath })
        }
      } catch (err) {
        this.log(`Invalid file path: ${filePath}, error: ${err.message}`, 'warn')
      }
    }

    if (fileInfos.length > 0) {
      await this.uploadFiles(fileInfos)
    }
  }

  downloadFiles () {
    const sess = this.getSession()
    if (!sess) {
      this.log('File transfer not available - no session', 'error')
      return
    }

    if (this.pendingDownloads.size === 0) {
      this.log('No files available for download', 'info')
      return
    }

    this.pendingDownloads.forEach((fileInfo, index) => {
      try {
        const sizeStreamId = index + 1
        const fileInfoWithIndex = { ...fileInfo, _fileIndex: index }
        this.streamToFileInfo.set(sizeStreamId, fileInfoWithIndex)

        const requestSizeExt = new window.ironRdp.Extension('request_file_contents', {
          stream_id: sizeStreamId,
          file_index: index,
          flags: 0x00000001,
          position: 0,
          size: 8,
          clip_data_id: fileInfo.clipDataId
        })

        sess.invokeExtension(requestSizeExt)
      } catch (err) {
        this.log(`Failed to request ${fileInfo.name || `file_${index}`}: ${err.message}`, 'error')
      }
    })
  }

  formatFileSize (bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  cleanup () {
    this.uploadedFiles.clear()
    this.pendingDownloads.clear()
    this.streamToFileInfo.clear()
    this.hasRemoteFiles = false
    this.notifyStateChange()
  }
}
