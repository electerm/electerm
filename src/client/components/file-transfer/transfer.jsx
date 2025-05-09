import { Component } from 'react'
import copy from 'json-deep-copy'
import { isFunction } from 'lodash-es'
import generate from '../../common/uid'
import { typeMap, transferTypeMap, fileOperationsMap, fileActions } from '../../common/constants'
import fs from '../../common/fs'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import {
  getLocalFileInfo,
  getRemoteFileInfo,
  getFolderFromFilePath
} from '../sftp/file-read'
import resolve from '../../common/resolve'
import { refsTransfers, refsStatic, refs } from '../common/ref'
import './transfer.styl'

const { assign } = Object

export default class TransportAction extends Component {
  constructor (props) {
    super(props)
    const {
      id,
      transferBatch = '',
      tabId
    } = props.transfer
    this.id = `tr-${transferBatch}-${id}`
    this.tabId = tabId
    refsTransfers.add(this.id, this)
    this.total = 0
    this.transferred = 0
    this.currentProgress = 1
    this.isFtp = refs.get('sftp-' + tabId)?.type === 'ftp'
  }

  componentDidMount () {
    if (this.props.inited) {
      this.initTransfer()
    }
  }

  componentDidUpdate (prevProps) {
    if (
      prevProps.inited !== this.props.inited &&
      this.props.inited === true
    ) {
      this.initTransfer()
    }
    if (
      this.props.pausing !== prevProps.pausing
    ) {
      if (this.props.pausing) {
        this.pause()
      } else {
        this.resume()
      }
    }
  }

  componentWillUnmount () {
    this.transport && this.transport.destroy()
    this.transport = null
    this.fromFile = null
    refsTransfers.remove(this.id)
  }

  localCheckExist = (path) => {
    return getLocalFileInfo(path).catch(console.log)
  }

  remoteCheckExist = (path, tabId) => {
    // return true
    const sftp = refs.get('sftp-' + tabId)?.sftp
    if (!sftp) {
      console.log('remoteCheckExist error', 'sftp not exist')
      return false
    }
    return getRemoteFileInfo(sftp, path)
      .then(r => r)
      .catch((e) => {
        console.log('remoteCheckExist error', e)
        return false
      })
  }

  checkExist = (type, path, tabId) => {
    return this[type + 'CheckExist'](path, tabId)
  }

  update = (up) => {
    const { id } = this.props.transfer
    refsStatic.get('transfer-queue')?.addToQueue(
      'update',
      id,
      up
    )
  }

  tagTransferError = (id, errorMsg) => {
    // this.clear()
    const { store } = window
    const { fileTransfers } = store
    const index = fileTransfers.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }

    const tr = copy(fileTransfers[index])
    assign(tr, {
      host: tr.host,
      error: errorMsg,
      finishTime: Date.now()
    })
    store.addTransferHistory(tr)
    refsStatic.get('transfer-queue')?.addToQueue(
      'delete',
      id
    )
  }

  // insert = (insts) => {
  //   const { fileTransfers } = window.store
  //   const { index } = this.props
  //   fileTransfers.splice(index, 1, ...insts)
  // }

  remoteList = () => {
    window.store.remoteList(this.tabId)
  }

  localList = () => {
    window.store.localList(this.tabId)
  }

  onEnd = (update = {}) => {
    if (this.onCancel) {
      return
    }
    const {
      transfer,
      config
    } = this.props
    const {
      typeTo
    } = transfer
    const finishTime = Date.now()
    if (!config.disableTransferHistory) {
      const fromFile = transfer.fromFile || this.fromFile
      const size = update.size || fromFile.size
      const r = copy(transfer)
      assign(r, {
        finishTime,
        startTime: this.startTime,
        size,
        next: null,
        speed: format(size, this?.startTime)
      })
      window.store.addTransferHistory(
        r
      )
    }
    const cbs = [
      this[typeTo + 'List']
    ]
    const cb = () => {
      cbs.forEach(cb => cb())
    }
    this.cancel(cb)
  }

  onData = (transferred) => {
    if (this.onCancel) {
      return
    }
    const { transfer } = this.props
    const up = {}
    const total = transfer.fromFile.size
    let percent = total === 0
      ? 0
      : Math.floor(100 * transferred / total)
    percent = percent >= 100 ? 99 : percent
    up.percent = percent
    up.status = 'active'
    up.transferred = transferred
    up.startTime = this.startTime
    up.speed = format(transferred, up.startTime)
    assign(
      up,
      computeLeftTime(transferred, total, up.startTime)
    )
    up.passedTime = computePassedTime(up.startTime)
    this.update(up)
  }

  cancel = (callback) => {
    if (this.onCancel) {
      return
    }
    this.onCancel = true
    this.transport && this.transport.destroy()
    this.transport = null
    // window.store.cancelTransfer(this.props.transfer.id)
    refsStatic.get('transfer-queue')?.addToQueue(
      'delete',
      this.props.transfer.id
    )
    if (isFunction(callback)) {
      callback()
    }
  }

  pause = () => {
    this.transport?.pause()
  }

  resume = () => {
    this.transport?.resume()
  }

  mvOrCp = () => {
    const {
      transfer
    } = this.props
    const {
      fromPath,
      toPath,
      typeFrom,
      tabId,
      operation // 'mv' or 'cp'
    } = transfer

    let finalToPath = toPath

    // Check if it's a copy operation to the same path
    if (fromPath === toPath && operation === fileOperationsMap.cp) {
      finalToPath = this.handleRename(toPath, typeFrom === typeMap.remote)
      transfer.toPath = finalToPath
      this.update({
        toPath: finalToPath
      })
    }
    if (typeFrom === typeMap.local) {
      return fs[operation](fromPath, finalToPath)
        .then(this.onEnd)
        .catch(e => {
          this.onEnd()
          this.onError(e)
        })
    }
    const sftp = refs.get('sftp-' + tabId)?.sftp
    return sftp[operation](fromPath, finalToPath)
      .then(this.onEnd)
      .catch(e => {
        this.onEnd()
        this.onError(e)
      })
  }

  transferFile = async (transfer = this.props.transfer) => {
    const {
      fromPath,
      typeFrom,
      toFile = {}
    } = transfer
    const toPath = this.newPath || transfer.toPath
    const fromFile = transfer.fromFile || this.fromFile
    const fromMode = fromFile.mode
    const transferType = typeFrom === typeMap.local ? transferTypeMap.upload : transferTypeMap.download
    const isDown = transferType === transferTypeMap.download
    const localPath = isDown
      ? toPath
      : fromPath
    const remotePath = isDown
      ? fromPath
      : toPath
    const mode = toFile.mode || fromMode
    const sftp = refs.get('sftp-' + this.tabId).sftp
    this.transport = await sftp[transferType]({
      remotePath,
      localPath,
      options: { mode },
      onData: this.onData,
      onError: this.onError,
      onEnd: this.onEnd
    })
  }

  isTransferAction = (action) => {
    return action.includes('rename') || action === 'transfer'
  }

  initTransfer = async () => {
    if (this.started) {
      return
    }
    this.started = true
    const { transfer } = this.props
    const {
      id,
      typeFrom,
      typeTo,
      fromPath,
      toPath,
      operation
    } = transfer

    if (
      typeFrom === typeTo &&
      fromPath === toPath &&
      operation === fileOperationsMap.mv
    ) {
      return this.cancel()
    }

    const t = Date.now()
    this.update({
      startTime: t
    })
    this.startTime = t

    const fromFile = transfer.fromFile
      ? transfer.fromFile
      : await this.checkExist(typeFrom, fromPath, this.tabId)
    if (!fromFile) {
      return this.tagTransferError(id, 'file not exist')
    }
    this.fromFile = fromFile
    this.update({
      fromFile
    })
    if (fromPath === toPath && typeFrom === typeTo) {
      return this.mvOrCp()
    }
    const hasConflict = await this.checkConflict()
    if (hasConflict) {
      return
    }

    if (typeFrom === typeTo) {
      return this.mvOrCp()
    }
    this.startTransfer()
  }

  checkConflict = async (transfer = this.props.transfer) => {
    const {
      typeTo,
      toPath,
      tabId
    } = transfer
    const transferStillExists = window.store.fileTransfers.some(t => t.id === transfer.id)
    if (!transferStillExists) {
      return false
    }
    const toFile = await this.checkExist(typeTo, toPath, tabId)

    if (toFile) {
      this.update({
        toFile
      })
      if (transfer.resolvePolicy) {
        return this.onDecision(transfer.resolvePolicy)
      }
      if (this.resolvePolicy) {
        return this.onDecision(this.resolvePolicy)
      }
      const transferWithToFile = {
        ...copy(transfer),
        toFile,
        fromFile: copy(transfer.fromFile || this.fromFile)
      }
      refsStatic.get('transfer-conflict')?.addConflict(transferWithToFile)
      return true
    }
  }

  onDecision = (policy) => {
    if (policy === fileActions.skip || policy === fileActions.cancel) {
      return this.onEnd()
    }

    if (policy === fileActions.rename) {
      const {
        typeTo,
        toPath
      } = this.props.transfer
      const newPath = this.handleRename(toPath, typeTo === typeMap.remote)
      this.update({
        toPath: newPath
      })
      this.newPath = newPath
    }

    this.startTransfer()
  }

  startTransfer = async () => {
    const { fromFile = this.fromFile } = this.props.transfer

    if (!fromFile.isDirectory) {
      return this.transferFile()
    }
    await this.transferFolderRecursive()
    this.onEnd({
      transferred: this.transferred,
      size: this.total
    })
  }

  list = async (type, path, tabId) => {
    const sftp = refs.get('sftp-' + tabId)
    return sftp[type + 'List'](true, path)
  }

  handleRename = (fromPath, isRemote) => {
    const { path, base, ext } = getFolderFromFilePath(fromPath, isRemote)
    const newName = `${base}(rename-${generate()})${ext ? '.' + ext : ''}`
    return resolve(path, newName)
  }

  onFolderData = (transferred) => {
    if (this.onCancel) {
      return
    }
    this.transferred += transferred
    const up = {}

    // Increment progress slightly with each file/folder (but never exceed 99%)
    this.currentProgress = Math.min(this.currentProgress + 0.2, 99)

    up.percent = Math.floor(this.currentProgress)
    up.status = 'active'
    up.transferred = this.transferred
    up.startTime = this.startTime
    up.speed = format(this.transferred, up.startTime)
    assign(
      up,
      computeLeftTime(this.transferred, this.total, up.startTime)
    )
    up.passedTime = computePassedTime(up.startTime)
    this.update(up)
  }

  transferFileAsSubTransfer = async (transfer) => {
    const {
      fromPath,
      toPath,
      typeFrom,
      fromFile: {
        mode: fromMode,
        size: fileSize
      },
      toFile = {}
    } = transfer

    const transferType = typeFrom === typeMap.local ? transferTypeMap.upload : transferTypeMap.download
    const isDown = transferType === transferTypeMap.download
    const localPath = isDown ? toPath : fromPath
    const remotePath = isDown ? fromPath : toPath
    const mode = toFile.mode || fromMode
    const sftp = refs.get('sftp-' + this.tabId).sftp

    return new Promise((resolve, reject) => {
      let transport

      const onSubEnd = () => {
        if (fileSize) {
          this.onFolderData(fileSize)
        }
        if (transport) {
          transport.destroy()
          transport = null
        }
        resolve(fileSize)
      }

      const onSubError = (error) => {
        if (transport) {
          transport.destroy()
          transport = null
        }
        reject(error)
      }

      sftp[transferType]({
        remotePath,
        localPath,
        options: { mode },
        onData: () => {},
        onError: onSubError,
        onEnd: onSubEnd
      }).then(transportInstance => {
        transport = transportInstance
      }).catch(onSubError)
    })
  }

  getDefaultTransfer = () => {
    const transfer = this.props.transfer
    if (this.newPath) {
      const modifiedTransfer = {
        ...transfer,
        toPath: this.newPath,
        isRenamed: true
      }
      return modifiedTransfer
    }
    return transfer
  }

  // Handle file transfers in parallel batches
  transferFiles = async (files, batch, transfer) => {
    if (this.onCancel) {
      return
    }

    const { fromPath, toPath } = transfer

    // Process files in batches
    for (let i = 0; i < files.length; i += batch) {
      if (this.onCancel) {
        return
      }

      const batchFiles = files.slice(i, i + batch)
      const promises = batchFiles.map(file => {
        if (this.onCancel) {
          return Promise.resolve(0)
        }

        const fromItemPath = resolve(fromPath, file.name)
        const toItemPath = resolve(toPath, file.name)

        const itemTransfer = {
          ...transfer,
          fromPath: fromItemPath,
          toPath: toItemPath,
          fromFile: file
        }

        return this.transferFileAsSubTransfer(itemTransfer)
      })

      // Wait for all files in batch to complete
      const results = await Promise.all(promises)

      // Update progress once for the entire batch
      const batchTotalSize = results.reduce((sum, size) => sum + size, 0)
      if (batchTotalSize > 0) {
        this.onFolderData(batchTotalSize)
      }
    }
  }

  // Handle folder transfers sequentially to prevent concurrency explosion
  transferFolders = async (folders, batch, transfer) => {
    if (this.onCancel) {
      return
    }

    const { fromPath, toPath } = transfer

    // Step 1: Create all folders concurrently in batches
    for (let i = 0; i < folders.length; i += batch) {
      if (this.onCancel) {
        return
      }

      const batchFolders = folders.slice(i, i + batch)
      const createFolderPromises = batchFolders.map(folder => {
        const toItemPath = resolve(toPath, folder.name)

        // Create folder itself (don't process contents)
        const createTransfer = {
          ...transfer,
          toPath: toItemPath,
          fromFile: folder
        }

        return this.mkdir(createTransfer)
      })

      // Create all folders in this batch concurrently
      await Promise.all(createFolderPromises)
    }

    // Step 2: Process contents of each folder sequentially
    for (const folder of folders) {
      if (this.onCancel) {
        return
      }

      const fromItemPath = resolve(fromPath, folder.name)
      const toItemPath = resolve(toPath, folder.name)

      const itemTransfer = {
        ...transfer,
        fromPath: fromItemPath,
        toPath: toItemPath,
        fromFile: folder
      }

      // Transfer folder contents (set createFolder = false since we already created it)
      await this.transferFolderRecursive(itemTransfer, false)
    }
  }

  // Main recursive function using the separate handlers
  transferFolderRecursive = async (transfer = this.getDefaultTransfer(), createFolder = true) => {
    if (this.onCancel) {
      return
    }
    const {
      fromPath,
      typeFrom,
      tabId,
      toFile,
      isRenamed
    } = transfer

    if (createFolder && (!toFile || isRenamed)) {
      const folderCreated = await this.mkdir(transfer)
      if (!folderCreated) {
        return
      }
    }

    const list = await this.list(typeFrom, fromPath, tabId)
    const bigFileSize = 1024 * 1024
    const smallFilesBatch = this.isFtp ? 1 : 30
    const BigFilesBatch = this.isFtp ? 1 : 3
    const foldersBatch = this.isFtp ? 1 : 50

    const {
      folders,
      smallFiles,
      largeFiles
    } = list.reduce((p, c) => {
      if (c.isDirectory) {
        p.folders.push(c)
      } else {
        this.total += c.size
        if (c.size < bigFileSize) {
          p.smallFiles.push(c)
        } else {
          p.largeFiles.push(c)
        }
      }
      return p
    }, {
      folders: [],
      smallFiles: [],
      largeFiles: []
    })

    // Process files with parallel batching
    await this.transferFiles(smallFiles, smallFilesBatch, transfer)
    await this.transferFiles(largeFiles, BigFilesBatch, transfer)

    // Process folders sequentially
    await this.transferFolders(folders, foldersBatch, transfer)
  }

  onError = (e) => {
    const up = {
      status: 'exception',
      error: e.message
    }
    this.onEnd(up)
    window.store.onError(e)
  }

  mkdir = async (transfer = this.props.transfer) => {
    const {
      typeTo,
      toPath,
      tabId
    } = transfer
    if (typeTo === typeMap.local) {
      return fs.mkdir(toPath)
        .then(() => true)
        .catch(() => false)
    }
    const sftp = refs.get('sftp-' + tabId).sftp
    return sftp.mkdir(toPath)
      .then(() => true)
      .catch(() => false)
  }

  render () {
    return null
  }
}
