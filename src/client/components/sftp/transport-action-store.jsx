import { Component } from '../common/react-subx'
import copy from 'json-deep-copy'
import { findIndex, isFunction } from 'lodash-es'
import generate from '../../common/uid'
import { typeMap, transferTypeMap, commonActions } from '../../common/constants'
import fs from '../../common/fs'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import { getFolderFromFilePath } from './file-read'
import resolve from '../../common/resolve'
import delay from '../../common/wait'
import postMsg from '../../common/post-msg'
import { zipCmd, unzipCmd, rmCmd, mvCmd, mkdirCmd } from './zip'
import './transfer.styl'

export default class TransportAction extends Component {
  constructor (props) {
    super(props)
    this.sessionId = props.transfer.sessionId
  }

  inst = {}
  unzipping = false

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
      this.props.cancel === true &&
      prevProps.cancel !== true
    ) {
      this.cancel()
    }
    if (
      this.props.pause !== prevProps.pause
    ) {
      if (this.props.pause) {
        this.pause()
      } else {
        this.resume()
      }
    }
  }

  update = (up) => {
    const { store, transfer } = this.props
    const {
      fileTransfers
    } = store
    const index = findIndex(fileTransfers, t => t.id === transfer.id)
    if (index < 0) {
      return store.setFileTransfers(fileTransfers)
    }
    window.store.editTransfer(
      fileTransfers[index].id,
      up
    )
    Object.assign(fileTransfers[index], up)
    store.setFileTransfers(fileTransfers)
  }

  insert = (insts) => {
    const { store, transfer } = this.props
    const {
      fileTransfers
    } = store
    const index = findIndex(fileTransfers, t => t.id === transfer.id)
    fileTransfers.splice(index, 1, ...insts)
    store.setFileTransfers(fileTransfers)
  }

  remoteList = () => {
    postMsg({
      action: commonActions.sftpList,
      sessionId: this.sessionId,
      type: typeMap.remote
    })
  }

  localList = () => {
    postMsg({
      action: commonActions.sftpList,
      sessionId: this.sessionId,
      type: typeMap.local
    })
  }

  onEnd = (update = {}) => {
    if (this.inst.onCancel) {
      return
    }
    const {
      transfer
    } = this.props
    const {
      typeTo,
      next
    } = transfer
    const cb = this[typeTo + 'List']
    const finishTime = Date.now()
    if (!this.props.store.config.disableTransferHistory) {
      window.store.addTransferHistory(
        {
          ...transfer,
          ...update,
          finishTime,
          startTime: this.inst.startTime,
          size: transfer.fromFile.size,
          next: null,
          speed: format(transfer.fromFile.size, this.inst.startTime)
        }
      )
    }
    if (next) {
      this.insert([copy(next)])
    }
    this.cancel(cb)
  }

  onData = (transferred) => {
    if (this.inst.onCancel) {
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
    up.startTime = this.inst.startTime
    up.speed = format(transferred, up.startTime)
    Object.assign(
      up,
      computeLeftTime(transferred, total, up.startTime)
    )
    up.passedTime = computePassedTime(up.startTime)
    this.update(up)
  }

  cancel = (callback) => {
    if (this.inst.onCancel) {
      return
    }
    const {
      transfer,
      store
    } = this.props
    this.inst.onCancel = true
    const { id } = transfer
    this.inst.transport && this.inst.transport.destroy()
    let {
      fileTransfers
    } = store
    fileTransfers = fileTransfers.filter(t => {
      return t.id !== id
    })
    store.setFileTransfers(fileTransfers)
    if (isFunction(callback)) {
      callback()
    }
  }

  pause = () => {
    this.inst.transport && this.inst.transport.pause()
  }

  resume = () => {
    this.inst.transport && this.inst.transport.resume()
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
    const sftp = window.sftps[sessionId]
    return sftp[operation](fromPath, toPath)
      .then(this.onEnd)
      .catch(e => {
        this.onEnd()
        this.onError(e)
      })
  }

  zipTransfer = async () => {
    const {
      transfer
    } = this.props
    const {
      fromPath,
      toPath,
      typeFrom,
      sessionId
    } = transfer
    let p
    let isFromRemote
    if (typeFrom === typeMap.local) {
      isFromRemote = false
      p = await fs.zipFolder(fromPath)
    } else {
      isFromRemote = true
      p = await zipCmd('', sessionId, fromPath)
    }
    const { name } = getFolderFromFilePath(p, isFromRemote)
    const { path } = getFolderFromFilePath(toPath, !isFromRemote)
    const nTo = resolve(path, name)
    const newTrans1 = {
      ...copy(transfer),
      toPathReal: transfer.toPath,
      fromPathReal: transfer.fromPath,
      toPath: nTo,
      fromPath: p,
      originalId: transfer.id,
      id: generate()
    }
    delete newTrans1.fromFile
    delete newTrans1.inited
    delete newTrans1.zip
    const newTrans2 = copy(newTrans1)
    newTrans2.unzip = true
    newTrans2.id = generate()
    newTrans1.next = newTrans2
    this.insert([newTrans1])
  }

  buildUnzipPath = (transfer) => {
    const {
      newName,
      toPath,
      typeTo,
      oldName
    } = transfer
    const isToRemote = typeTo === typeMap.remote
    const { path } = getFolderFromFilePath(toPath, isToRemote)
    const np = newName
      ? resolve(path, 'temp-' + newName)
      : path
    return {
      targetPath: path,
      path: np,
      name: oldName
    }
  }

  unzipFile = async () => {
    if (this.unzipping) {
      return false
    }
    this.unzipping = true
    const { transfer } = this.props
    const {
      fromPath,
      toPath,
      typeTo,
      newName,
      sessionId
    } = transfer
    const isToRemote = typeTo === typeMap.remote
    const {
      path,
      name,
      targetPath
    } = this.buildUnzipPath(transfer)
    if (isToRemote) {
      if (newName) {
        await mkdirCmd('', sessionId, path)
        await delay(1000)
      }
      await unzipCmd('', sessionId, toPath, path)
      if (newName) {
        const mvFrom = resolve(path, name)
        const mvTo = resolve(targetPath, newName)
        await mvCmd('', sessionId, mvFrom, mvTo)
      }
    } else {
      if (newName) {
        await fs.mkdir(path)
      }
      await fs.unzipFile(toPath, path)
      if (newName) {
        const mvFrom = resolve(path, name)
        const mvTo = resolve(targetPath, newName)
        await fs.mv(mvFrom, mvTo)
      }
    }
    await rmCmd('', sessionId, !isToRemote ? fromPath : toPath)
    await fs.rmrf(!isToRemote ? toPath : fromPath)
    if (newName) {
      if (isToRemote) {
        await rmCmd('', sessionId, path)
      } else {
        await fs.rmrf(path)
      }
    }
    this.onEnd()
  }

  doTransfer = async () => {
    const { transfer } = this.props
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
    const sftp = window.sftps[this.sessionId]
    this.inst.transport = await sftp[transferType]({
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
    if (this.inst.started) {
      return
    }
    const { transfer } = this.props
    const {
      typeFrom,
      typeTo,
      fromFile: {
        isDirectory
      },
      action,
      expanded,
      zip,
      unzip,
      inited
    } = transfer
    const t = Date.now()
    this.update({
      startTime: t
    })
    this.inst.startTime = t
    this.inst.started = true
    if (unzip && inited) {
      this.unzipFile()
    } else if (zip && inited) {
      this.zipTransfer()
    } else if (typeFrom === typeTo) {
      return this.mvOrCp()
    } else if (isDirectory && expanded && this.isTransferAction(action)) {
      return this.mkdir()
        .then(this.onEnd)
        .catch(this.onError)
    } else if (!isDirectory) {
      this.doTransfer()
    } else if (expanded && isDirectory && !this.isTransferAction(action)) {
      this.cancel()
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

  mkdir = async () => {
    const {
      transfer
    } = this.props
    const {
      typeTo,
      toPath,
      sessionId
    } = transfer
    if (typeTo === typeMap.local) {
      return fs.mkdir(toPath)
        .catch(this.onError)
    }
    const sftp = window.sftps[sessionId]
    return sftp.mkdir(toPath)
      .catch(this.onError)
  }

  render () {
    return null
  }
}
