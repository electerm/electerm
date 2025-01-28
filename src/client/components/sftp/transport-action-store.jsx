import { Component } from 'react'
import copy from 'json-deep-copy'
import { isFunction } from 'lodash-es'
import generate from '../../common/uid'
import { typeMap, transferTypeMap } from '../../common/constants'
import fs from '../../common/fs'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import {
  getFolderFromFilePath
} from './file-read'
import resolve from '../../common/resolve'
import delay from '../../common/wait'
import { refs } from '../common/ref'
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
      typeTo,
      next
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
    if (next) {
      cbs.push(() => {
        setTimeout(
          () => {
            window.store.fileTransfers.splice(
              this.props.index, 0, copy(next)
            )
          },
          100
        )
      })
    }
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
    this.transport && this.transport.pause()
  }

  resume = () => {
    this.transport && this.transport.resume()
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
    delete newTrans1.inited
    delete newTrans1.zip
    delete newTrans1.fromFile
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
    this.startTime = t
    this.started = true
    if (typeFrom === typeTo) {
      return this.mvOrCp()
    } else if (unzip && inited) {
      this.unzipFile()
    } else if (zip && inited) {
      this.zipTransfer()
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
    const sftp = refs.get('sftp-' + sessionId).sftp
    return sftp.mkdir(toPath)
      .catch(this.onError)
  }

  render () {
    return null
  }
}
