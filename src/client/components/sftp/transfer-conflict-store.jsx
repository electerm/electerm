/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { PureComponent } from 'react'
import { typeMap } from '../../common/constants'
import {
  getLocalFileInfo,
  getRemoteFileInfo,
  getFolderFromFilePath,
  getFileExt,
  checkFolderSize
} from './file-read'
import { refsStatic, refs } from '../common/ref'
import generate from '../../common/uid'
import resolve from '../../common/resolve'
import deepCopy from 'json-deep-copy'

const { assign } = Object

export default class TransferConflictStore extends PureComponent {
  state = {
    currentId: ''
  }

  componentDidMount () {
    this.id = 'transfer-conflict'
    refsStatic.add(this.id, this)
    this.watchFile()
  }

  componentDidUpdate (prevProps) {
    if (
      prevProps.fileTransferChanged !== this.props.fileTransferChanged
    ) {
      this.watchFile()
    }
  }

  localCheckExist = (path) => {
    return getLocalFileInfo(path)
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

  rename = (tr, action, _renameId) => {
    const isRemote = tr.typeTo === typeMap.remote
    const { path, name } = getFolderFromFilePath(tr.toPath, isRemote)
    const { base, ext } = getFileExt(name)
    const renameId = _renameId || generate()
    const newName = ext
      ? `${base}(rename-${renameId}).${ext}`
      : `${base}(rename-${renameId})`
    assign(tr, {
      renameId,
      newName,
      oldName: base,
      toPath: resolve(path, newName)
    })
    if (action) {
      tr.action = action
    }
    return tr
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

    const { store } = window
    const { fileTransfers } = store
    const index = fileTransfers.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }
    const tr = fileTransfers[index]
    tr.fromFile = deepCopy(fromFile)
    tr.action = action
    tr.r = Math.random()
    if (action === 'skip') {
      return fileTransfers.splice(index, 1)
    } else if (action === 'cancel') {
      return store.skipAllTransfersSinceIndex(index)
    }
    if (action.includes('All')) {
      return store.updateTransfersFromIndex(index, {
        action: action.replace('All', '')
      })
    }
    if (action.includes('rename')) {
      return this.rename(tr)
    }
  }

  tagTransferError = (id, errorMsg) => {
    this.clear()
    const { store } = window
    const { fileTransfers } = store
    const index = fileTransfers.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }

    const [tr] = fileTransfers.splice(index, 1)
    assign(tr, {
      host: tr.host,
      error: errorMsg,
      finishTime: Date.now()
    })
    store.addTransferHistory(tr)
  }

  setConflict (tr) {
    if (this.props.transferToConfirm.id) {
      return
    }
    window.store.transferToConfirm = tr
  }

  onDecision = (data) => {
    if (
      data.id === this.currentId
    ) {
      this.currentId = ''
      this.updateTransferAction(data)
      this.onConfirm = false
      window.removeEventListener('message', this.onDecision)
    }
  }

  updateData = () => {
    const {
      store
    } = window
    const {
      fileTransfers
    } = store
    if (fileTransfers.length > 0) {
      fileTransfers[0].r = Math.random()
    }
  }

  setCanTransfer = (fromFile, tr) => {
    this.clear()
    const {
      store
    } = window
    const {
      fileTransfers
    } = store
    const index = fileTransfers.findIndex(t => {
      return t.id === tr.id
    })
    if (index < 0) {
      setTimeout(this.updateData, 0)
      return
    }
    const up = {
      action: 'transfer',
      fromFile
    }
    assign(fileTransfers[index], up)
    // may have issue
  }

  clear = () => {
    this.currentId = ''
  }

  watchFile = async () => {
    const { store } = window
    const {
      fileTransfers
    } = store
    if (!fileTransfers.length) {
      return this.clear()
    }
    const tr = fileTransfers
      .find(t => {
        return (
          !t.action ||
          !t.fromFile ||
          t.fromFile.isDirectory
        )
      })
    if (!tr) {
      this.onConfirm = false
      return this.clear()
    }
    if (this.currentId) {
      return
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
    if (fromFile.isDirectory && typeFrom !== typeTo) {
      const props = {
        sftp: refs.get('sftp-' + sessionId).sftp
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
      assign(tr, {
        operation: 'cp',
        fromFile
      })
      return this.updateTransferAction({
        id,
        action: 'rename',
        transfer: tr
      })
    } else if (toFile && !action && !skipConfirm) {
      if (!this.onConfirm) {
        this.onConfirm = true
        assign(tr, {
          fromFile,
          toFile
        })
        return this.setConflict(tr)
      }
    } else if (toFile && !tr.fromFile && action) {
      assign(tr, {
        fromFile
      })
      return this.updateTransferAction({
        id,
        action,
        transfer: tr
      })
    }
    this.setCanTransfer(fromFile, tr)
  }

  render () {
    return null
  }
}
