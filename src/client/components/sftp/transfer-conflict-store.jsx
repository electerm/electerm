/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { Component } from '../common/react-subx'
import { typeMap } from '../../common/constants'
import {
  getLocalFileInfo,
  getRemoteFileInfo,
  getFolderFromFilePath,
  getFileExt,
  checkFolderSize
} from './file-read'
import { findIndex, find } from 'lodash-es'
import generate from '../../common/uid'
import resolve from '../../common/resolve'

export default class TransferConflictStore extends Component {
  state = {
    currentId: ''
  }

  componentDidMount () {
    this.watchFile()
  }

  componentDidUpdate (prevProps) {
    if (
      prevProps._fileTransfers !== this.props._fileTransfers
    ) {
      this.watchFile()
    }
  }

  localCheckExist = (path) => {
    return getLocalFileInfo(path)
  }

  remoteCheckExist = (path, sessionId) => {
    const sftp = window.sftps[sessionId]
    return getRemoteFileInfo(sftp, path)
      .then(r => r)
      .catch(() => false)
  }

  checkExist = (type, path, sessionId) => {
    return this[type + 'CheckExist'](path, sessionId)
  }

  rename = (tr, action, _renameId) => {
    const isRemote = tr.typeTo === typeMap.remote
    const { path, name } = getFolderFromFilePath(tr.toPath, isRemote)
    const { base, ext } = getFileExt(name)
    const renameId = _renameId || generate()
    const newName = ext
      ? `${base}(rename-${renameId}).${ext}`
      : `${base}(rename-${renameId})`
    const res = {
      ...tr,
      renameId,
      newName,
      oldName: base,
      toPath: resolve(path, newName)
    }
    if (action) {
      res.action = action
    }
    return res
  }

  updateTransferAction = (data) => {
    const {
      id,
      action,
      transfer
    } = data
    const {
      fromFile
    } = transfer
    this.clear()
    const { store } = this.props
    let {
      fileTransfers
    } = store
    const index = findIndex(fileTransfers, d => d.id === id)
    if (index < 0) {
      return store.setFileTransfers(fileTransfers)
    }
    fileTransfers[index].fromFile = fromFile
    fileTransfers[index].action = action
    if (action === 'skip') {
      fileTransfers.splice(index, 1)
    } else if (action === 'cancel') {
      fileTransfers = fileTransfers.slice(0, index)
    }
    if (action.includes('All')) {
      fileTransfers = fileTransfers.map((t, i) => {
        if (i < index) {
          return t
        }
        return {
          ...t,
          action: action.replace('All', '')
        }
      })
    }
    if (action.includes('rename')) {
      fileTransfers[index] = this.rename(fileTransfers[index])
    } else if (action === 'skipAll') {
      fileTransfers.splice(index, 1)
    }
    store.setFileTransfers(fileTransfers)
  }

  tagTransferError = (id, errorMsg) => {
    const { store } = this.props
    const {
      fileTransfers
    } = store
    const tr = find(fileTransfers, d => d.id === id)
    if (!tr) {
      return
    }
    window.store.addTransferHistory({
      ...tr,
      host: tr.host,
      error: errorMsg,
      finishTime: Date.now()
    })
    const index = findIndex(fileTransfers, d => d.id === id)
    if (index >= 0) {
      fileTransfers.splice(index, 1)
    }
    store.setFileTransfers(fileTransfers)
  }

  setConflict (tr) {
    if (window.store.transferToConfirm.id) {
      return
    }
    window.store.setState(
      'transferToConfirm', tr
    )
  }

  onDecision = (event) => {
    if (
      event &&
      event.data &&
      event.data.id === this.currentId
    ) {
      this.currentId = ''
      this.updateTransferAction(event.data)
      this.onConfirm = false
      window.removeEventListener('message', this.onDecision)
    }
  }

  waitForSignal = () => {
    window.addEventListener('message', this.onDecision)
  }

  setCanTransfer = (fromFile, tr) => {
    this.clear()
    const {
      store
    } = this.props
    const {
      fileTransfers
    } = store
    const index = findIndex(fileTransfers, t => {
      return t.id === tr.id
    })
    if (index >= 0) {
      const up = {
        action: 'transfer',
        fromFile
      }
      Object.assign(fileTransfers[index], up)
    } else {
      fileTransfers[0].r = Math.random()
    }
    store.setFileTransfers(fileTransfers)
  }

  clear = () => {
    this.currentId = ''
  }

  watchFile = async () => {
    const { store } = this.props
    const {
      fileTransfers
    } = store
    if (!fileTransfers.length && this.currentId) {
      return this.clear()
    }
    const tr = fileTransfers
      .filter(t => {
        return (
          !t.action ||
          !t.fromFile ||
          t.fromFile.isDirectory
        )
      })[0]
    if (!tr) {
      this.onConfirm = false
      return this.clear()
    }
    if (this.currentId) {
      // fileTransfers[0].r = Math.random()
      return store.setFileTransfers(fileTransfers)
    }
    this.currentId = tr.id
    const {
      typeFrom,
      typeTo,
      fromPath,
      toPath,
      id,
      action,
      renameId,
      parentId,
      skipConfirm,
      sessionId
    } = tr
    const fromFile = tr.fromFile
      ? tr.fromFile
      : await this.checkExist(typeFrom, fromPath, sessionId)
    if (!fromFile) {
      this.currentId = ''
      return this.tagTransferError(id, 'file not exist')
    }
    let toFile = false
    if (renameId || parentId) {
      toFile = false
    } else if (fromPath === toPath && typeFrom === typeTo) {
      toFile = true
    } else {
      toFile = await this.checkExist(typeTo, toPath, sessionId)
    }
    if (fromFile.isDirectory) {
      const props = {
        sftp: window.sftps[sessionId]
      }
      const skip = await checkFolderSize(props, fromFile)
        .then(d => d && typeFrom !== typeTo)
      if (!skip) {
        return this.tagTransferError(id, 'folder too big or too many files in folder')
      }
      tr.zip = true
      tr.skipExpand = true
    }
    if (fromPath === toPath && typeFrom === typeTo) {
      return this.updateTransferAction({
        id,
        action: 'rename',
        transfer: {
          ...tr,
          operation: 'cp',
          fromFile
        }
      })
    } else if (toFile && !action && !skipConfirm) {
      this.waitForSignal(id)
      if (!this.onConfirm) {
        this.onConfirm = true
        return this.setConflict({
          ...tr,
          fromFile,
          toFile
        })
      }
    } else if (toFile && !tr.fromFile && action) {
      return this.updateTransferAction({
        id,
        action,
        transfer: {
          ...tr,
          fromFile
        }
      })
    }
    this.setCanTransfer(fromFile, tr)
  }

  render () {
    return null
  }
}
