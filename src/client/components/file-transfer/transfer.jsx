import { Component } from 'react'
import copy from 'json-deep-copy'
import { isFunction } from 'lodash-es'
import generate from '../../common/uid'
import { typeMap, transferTypeMap, fileOperationsMap } from '../../common/constants'
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

export default class TransportAction extends Component {
  constructor (props) {
    super(props)
    this.sessionId = props.transfer.sessionId
    this.state = {
      transfer: copy(props.transfer),
      fromFile: null,
      conflictPolicy: '', //  could be skip, overwriteOrMerge, rename,
      conflictPolicyToAll: false
    }
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
    this.inst = null
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
    const { transfer } = this.props
    const {
      store
    } = window
    store.updateTransfer(
      transfer.id,
      up
    )
  }

  insert = (insts) => {
    const { fileTransfers } = window.store
    const { index } = this.props
    fileTransfers.splice(index, 1, ...insts)
  }

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
    const {
      transfer,
      config
    } = this.props
    const {
      typeTo
    } = transfer
    const finishTime = Date.now()
    if (!config.disableTransferHistory) {
      const r = copy(transfer)
      delete transfer.next
      Object.assign(r, update, {
        finishTime,
        startTime: this.startTime,
        size: transfer.fromFile.size,
        next: null,
        speed: format(transfer.fromFile.size, this?.startTime)
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
    Object.assign(
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
    window.store.fileTransfers.splice(
      this.props.index, 1
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
    if (this.started) {
      return
    }
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
    this.started = true
    const fromFile = transfer.fromFile
      ? transfer.fromFile
      : await this.checkExist(typeFrom, fromPath, this.sessionId)
    if (!fromFile) {
      return this.tagTransferError(id, 'file not exist')
    }
    // Check for conflict before starting transfer
    const hasConflict = await this.checkConflict()
    if (hasConflict) {
      return
    }

    if (
      typeFrom === typeTo
    ) {
      return this.mvOrCp()
    }
    this.startTransfer()
  }

  checkConflict = async (transfer = this.props.transfer, resolve) => {
    const {
      typeTo,
      toPath,
      sessionId
    } = transfer

    const fileExists = await this.checkExist(typeTo, toPath, sessionId)
    if (fileExists) {
      refsStatic.get('transfer-conflict')?.addConflict(transfer, resolve)
      return true
    }
  }

  startTransfer = async () => {
    const { fromFile } = this.state
    if (!fromFile.isDirectory) {
      return this.transferFile()
    }
    this.transferFolder()
  }

  list = async (type, path, sessionId) => {
    const sftp = refs.get('sftp-' + sessionId)
    return sftp[type + 'List'](path)
  }

  transferFolderRecursive = async (transfer = this.props.transfer) => {
    const {
      fromPath,
      toPath,
      typeFrom,
      typeTo,
      sessionId
    } = transfer
    const { conflictPolicy, conflictPolicyToAll } = this.state

    // Get list of items in the source folder
    const list = await this.list(typeFrom, fromPath, sessionId)

    // Process each item in the folder
    for (const item of list) {
      const fromItemPath = resolve(fromPath, item.name)
      const toItemPath = resolve(toPath, item.name)

      // Create a new transfer object for this item
      const itemTransfer = {
        ...transfer,
        fromPath: fromItemPath,
        toPath: toItemPath,
        fromFile: item
      }

      // Handle conflicts
      const handleConflict = async () => {
        if (conflictPolicyToAll) {
          return conflictPolicy
        }
        return new Promise(resolve => {
          refsStatic.get('transfer-conflict')?.addConflict(itemTransfer, resolve)
        })
      }

      // Handle rename operation
      const handleRename = (path) => {
        const { base, ext } = getFolderFromFilePath(item.name)
        const newName = `${base}(rename-${generate()})${ext ? '.' + ext : ''}`
        return resolve(toPath, newName)
      }

      // Check for conflicts
      let resolution
      const fileExists = await this.checkExist(typeTo, toItemPath, sessionId)
      if (fileExists) {
        resolution = await handleConflict()
        if (resolution === 'skip') {
          continue
        } else if (resolution === 'rename') {
          itemTransfer.toPath = handleRename(toItemPath)
        }
        // For overwriteOrMerge, we continue with the original path
      }

      if (item.isDirectory) {
        // For directories, only create if not overwriteOrMerge
        if (!(fileExists && (conflictPolicy === 'overwriteOrMerge' || resolution === 'overwriteOrMerge'))) {
          await this.mkdir(itemTransfer)
        }
        await this.transferFolderRecursive(itemTransfer)
      } else {
        await this.transferFile(itemTransfer)
      }
    }
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
        .catch(this.onError)
    }
    const sftp = refs.get('sftp-' + sessionId).sftp
    return sftp.mkdir(toPath)
      .catch(this.onError)
  }

  render () {
    return null
  }
}
