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
import { refs, refsStatic } from '../common/ref'
import './transfer.styl'

const { assign } = Object

export default class TransportAction extends Component {
  constructor (props) {
    super(props)
    this.sessionId = props.transfer.sessionId
    this.state = {
      conflictPolicy: '', //  could be skip, overwriteOrMerge, rename,
      conflictPolicyToAll: false
    }
    const {
      id,
      transferGroupId = ''
    } = props.transfer
    this.id = `tr-${transferGroupId}-${id}`
    refs.add(this.id, this)
    this.total = 0
    this.transferred = 0
  }

  componentDidMount () {
    console.log('componentDidMount', this.props.transfer)
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
  }

  localCheckExist = (path) => {
    return getLocalFileInfo(path).catch(console.log)
  }

  remoteCheckExist = (path, sessionId) => {
    const sftp = refs.get('sftp-' + sessionId).sftp
    return getRemoteFileInfo(sftp, path)
      .then(r => r)
      .catch(() => false)
  }

  checkExist = (type, path, sessionId) => {
    return this[type + 'CheckExist'](path, sessionId)
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
    window.store.remoteList(this.sessionId)
  }

  localList = () => {
    window.store.localList(this.sessionId)
  }

  onEnd = (update = {}) => {
    if (this.onCancel) {
      return
    }
    console.log('onEnd------')
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
    console.log('onCancel------')
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
      sessionId,
      operation // 'mv' or 'cp'
    } = transfer
    if (typeFrom === typeMap.local) {
      return fs[operation](fromPath, toPath)
        .then(this.onEnd)
        .catch(e => {
          this.onEnd()
          this.onError(e)
        })
    }
    const sftp = refs.get('sftp-' + sessionId).sftp
    return sftp[operation](fromPath, toPath)
      .then(this.onEnd)
      .catch(e => {
        this.onEnd()
        this.onError(e)
      })
  }

  // zipTransfer = async () => {
  //   const {
  //     transfer
  //   } = this.props
  //   const {
  //     fromPath,
  //     toPath,
  //     typeFrom,
  //     sessionId
  //   } = transfer
  //   let p
  //   let isFromRemote
  //   if (typeFrom === typeMap.local) {
  //     isFromRemote = false
  //     p = await fs.zipFolder(fromPath)
  //   } else {
  //     isFromRemote = true
  //     p = await zipCmd('', sessionId, fromPath)
  //   }
  //   const { name } = getFolderFromFilePath(p, isFromRemote)
  //   const { path } = getFolderFromFilePath(toPath, !isFromRemote)
  //   const nTo = resolve(path, name)
  //   const newTrans1 = {
  //     ...copy(transfer),
  //     toPathReal: transfer.toPath,
  //     fromPathReal: transfer.fromPath,
  //     toPath: nTo,
  //     fromPath: p,
  //     originalId: transfer.id,
  //     id: generate()
  //   }
  //   delete newTrans1.inited
  //   delete newTrans1.zip
  //   delete newTrans1.fromFile
  //   const newTrans2 = copy(newTrans1)
  //   newTrans2.unzip = true
  //   newTrans2.id = generate()
  //   newTrans1.next = newTrans2
  //   this.insert([newTrans1])
  // }

  // buildUnzipPath = (transfer) => {
  //   const {
  //     newName,
  //     toPath,
  //     typeTo,
  //     oldName
  //   } = transfer
  //   const isToRemote = typeTo === typeMap.remote
  //   const { path } = getFolderFromFilePath(toPath, isToRemote)
  //   const np = newName
  //     ? resolve(path, 'temp-' + newName)
  //     : path
  //   return {
  //     targetPath: path,
  //     path: np,
  //     name: oldName
  //   }
  // }

  // unzipFile = async () => {
  //   if (this.unzipping) {
  //     return false
  //   }
  //   this.unzipping = true
  //   const { transfer } = this.props
  //   const {
  //     fromPath,
  //     toPath,
  //     typeTo,
  //     newName,
  //     sessionId
  //   } = transfer
  //   const isToRemote = typeTo === typeMap.remote
  //   const {
  //     path,
  //     name,
  //     targetPath
  //   } = this.buildUnzipPath(transfer)
  //   if (isToRemote) {
  //     if (newName) {
  //       await mkdirCmd('', sessionId, path)
  //       await delay(1000)
  //     }
  //     await unzipCmd('', sessionId, toPath, path)
  //     if (newName) {
  //       const mvFrom = resolve(path, name)
  //       const mvTo = resolve(targetPath, newName)
  //       await mvCmd('', sessionId, mvFrom, mvTo)
  //     }
  //   } else {
  //     if (newName) {
  //       await fs.mkdir(path)
  //     }
  //     await fs.unzipFile(toPath, path)
  //     if (newName) {
  //       const mvFrom = resolve(path, name)
  //       const mvTo = resolve(targetPath, newName)
  //       await fs.mv(mvFrom, mvTo)
  //     }
  //   }
  //   await rmCmd('', sessionId, !isToRemote ? fromPath : toPath)
  //   await fs.rmrf(!isToRemote ? toPath : fromPath)
  //   if (newName) {
  //     if (isToRemote) {
  //       await rmCmd('', sessionId, path)
  //     } else {
  //       await fs.rmrf(path)
  //     }
  //   }
  //   this.onEnd()
  // }

  transferFile = async (transfer = this.props.transfer) => {
    const {
      fromPath,
      toPath,
      typeFrom,
      fromFile: {
        mode: fromMode
      },
      toFile = {}
    } = transfer
    const transferType = typeFrom === typeMap.local ? transferTypeMap.upload : transferTypeMap.download
    const isDown = transferType === transferTypeMap.download
    const localPath = isDown
      ? toPath
      : fromPath
    const remotePath = isDown
      ? fromPath
      : toPath
    const mode = toFile.mode || fromMode
    const sftp = refs.get('sftp-' + this.sessionId).sftp
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
    console.log('===========', this.props.transfer.id)
    console.log('Starting initTransfer')
    if (this.started) {
      console.log('Transfer already started, returning')
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
    console.log('Transfer details:', transfer)

    if (
      typeFrom === typeTo &&
      fromPath === toPath &&
      operation === fileOperationsMap.mv
    ) {
      console.log('Same source and destination with move operation, cancelling')
      return this.cancel()
    }

    const t = Date.now()
    console.log('Setting start time:', t)
    this.update({
      startTime: t
    })
    this.startTime = t

    console.log('Checking file existence')
    const fromFile = transfer.fromFile
      ? transfer.fromFile
      : await this.checkExist(typeFrom, fromPath, this.sessionId)
    console.log('=======file from', fromFile)
    if (!fromFile) {
      console.log('Source file does not exist')
      return this.tagTransferError(id, 'file not exist')
    }
    this.fromFile = fromFile
    this.update({
      fromFile
    })
    console.log('Source file found:', fromFile)

    console.log('Checking for conflicts')
    const hasConflict = await this.checkConflict()
    if (hasConflict) {
      console.log('Conflict detected, returning')
      return
    }

    if (typeFrom === typeTo) {
      console.log('Same source and destination types, performing mvOrCp')
      return this.mvOrCp()
    }

    console.log('Starting transfer between different types')
    this.startTransfer()
  }

  checkConflict = async (transfer = this.props.transfer, resolve) => {
    const {
      typeTo,
      toPath,
      sessionId
    } = transfer
    const transferStillExists = window.store.fileTransfers.some(t => t.id === transfer.id)
    if (!transferStillExists) {
      return false
    }
    // Get the target file information if it exists
    const toFile = await this.checkExist(typeTo, toPath, sessionId)

    if (toFile) {
      // Update the transfer object with the target file information
      const transferWithToFile = {
        ...transfer,
        toFile,
        fromFile: copy(transfer.fromFile || this.fromFile)
      }

      // Update the state with toFile information
      this.update({
        toFile
      })

      // Pass the updated transfer object with toFile to the conflict handler
      refsStatic.get('transfer-conflict')?.addConflict(transferWithToFile, resolve)
      return true
    }
  }

  onDecision = (policy) => {
    if (policy === fileActions.skip) {
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
    }
    this.startTransfer()
  }

  startTransfer = async () => {
    const { fromFile = this.fromFile } = this.props.transfer
    if (!fromFile.isDirectory) {
      return this.transferFile()
    }
    await this.transferFolderRecursive()
    console.log('Folder transfer completed')
    this.onEnd({
      transferred: this.transferred,
      size: this.total
    })
  }

  list = async (type, path, sessionId) => {
    const sftp = refs.get('sftp-' + sessionId)
    return sftp[type + 'List'](true, path)
  }

  handleRename = (fromPath, isRemote) => {
    const { base, ext } = getFolderFromFilePath(fromPath, isRemote)
    const newName = `${base}(rename-${generate()})${ext ? '.' + ext : ''}`
    return resolve(base, newName)
  }

  onFolderData = (transferred) => {
    if (this.onCancel) {
      return
    }
    this.transferred += transferred
    const up = {}
    let percent = this.total === 0
      ? 0
      : Math.floor(100 * this.transferred / this.total)
    percent = percent >= 100 ? 99 : percent
    up.percent = percent
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

  // Simplified sub-file transfer function for use within folder transfers
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
    const sftp = refs.get('sftp-' + this.sessionId).sftp

    return new Promise((resolve, reject) => {
      let transport

      const onSubEnd = () => {
      // Only update progress when the file transfer completes
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
        console.error(`Error transferring ${fromPath} to ${toPath}:`, error.message)
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
        onData: () => {}, // We can ignore per-chunk data updates
        onError: onSubError,
        onEnd: onSubEnd
      }).then(transportInstance => {
        transport = transportInstance
      }).catch(onSubError)
    })
  }

  transferFolderRecursive = async (transfer = this.props.transfer) => {
    if (this.onCancel) {
      return
    }
    console.log('transferFolderRecursive: Starting new folder transfer')
    const {
      fromPath,
      toPath,
      typeFrom,
      typeTo,
      sessionId
    } = transfer
    const { conflictPolicy, conflictPolicyToAll } = this.state
    const folderCreated = await this.mkdir(transfer)
    if (!folderCreated) {
      console.error(`transferFolderRecursive: Failed to create destination folder: ${toPath}`)
      return false
    }
    // Get list of items in the source folder
    console.log('transferFolderRecursive: Getting list from source folder:', fromPath)
    const list = await this.list(typeFrom, fromPath, sessionId)
    console.log('transferFolderRecursive: Found', list.map(item => item.name).join(','), 'items')

    // Process each item in the folder
    for (const item of list) {
      console.log('transferFolderRecursive: Processing item:', item.name)
      if (!item.isDirectory) {
        this.total += item.size
        console.log('transferFolderRecursive: Added to total size:', { file: item.name, size: item.size, total: this.total })
      }
      const fromItemPath = resolve(fromPath, item.name)
      const toItemPath = resolve(toPath, item.name)
      console.log('transferFolderRecursive: Paths resolved:', { from: fromItemPath, to: toItemPath })

      // Create a new transfer object for this item
      const itemTransfer = {
        ...transfer,
        fromPath: fromItemPath,
        toPath: toItemPath,
        fromFile: item
      }
      console.log('transferFolderRecursive: Created transfer object for:', item.name)

      // Handle conflicts
      const handleConflict = async () => {
        console.log('transferFolderRecursive: Handling conflict with policy:', { conflictPolicy, conflictPolicyToAll })
        if (conflictPolicyToAll) {
          return conflictPolicy
        }
        return new Promise(resolve => {
          refsStatic.get('transfer-conflict')?.addConflict(itemTransfer, resolve)
        })
      }

      // Check for conflicts
      let resolution
      const toFile = await this.checkExist(typeTo, toItemPath, sessionId)
      if (toFile) {
        console.log('transferFolderRecursive: Conflict detected for:', item.name)
        itemTransfer.toFile = toFile
        resolution = await handleConflict()
        console.log('transferFolderRecursive: Conflict resolution:', resolution)
        if (resolution === 'skip') {
          console.log('transferFolderRecursive: Skipping:', item.name)
          continue
        } else if (resolution === 'rename') {
          itemTransfer.toPath = this.handleRename(toItemPath, typeTo === typeMap.remote)
          console.log('transferFolderRecursive: Renamed to:', itemTransfer.toPath)
        }
        // For overwriteOrMerge, we continue with the original path
      }

      if (item.isDirectory) {
        console.log('transferFolderRecursive: Processing directory:', item.name)
        // For directories, only create if not overwriteOrMerge
        // if (!(toFile && (conflictPolicy === 'overwriteOrMerge' || resolution === 'overwriteOrMerge'))) {
        //   console.log('transferFolderRecursive: Creating directory:', item.name)
        //   await this.mkdir(itemTransfer)
        // }
        console.log('transferFolderRecursive: Starting recursive transfer for directory:', item.name)
        await this.transferFolderRecursive(itemTransfer)
      } else {
        console.log('transferFolderRecursive: Transferring file:', item.name)
        await this.transferFileAsSubTransfer(itemTransfer)
      }
    }
    console.log('transferFolderRecursive: Completed folder transfer for:', fromPath)
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
      sessionId
    } = transfer
    if (typeTo === typeMap.local) {
      return fs.mkdir(toPath)
        .then(() => true)
        .catch(console.log)
    }
    const sftp = refs.get('sftp-' + sessionId).sftp
    return sftp.mkdir(toPath)
      .then(() => true)
      .catch(console.log)
  }

  render () {
    return null
  }
}
