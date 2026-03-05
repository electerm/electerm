import { autoRun } from 'manate'
import copy from 'json-deep-copy'
import uid from '../../common/uid'
import resolve from '../../common/resolve'
import fs from '../../common/fs'
import { typeMap } from '../../common/constants'
import { getFolderFromFilePath, getLocalFileInfo } from '../sftp/file-read'

export default class Remote2RemoteHandler {
  constructor (props) {
    this.props = props
    this.id = uid()
  }

  get store () {
    return window.store
  }

  get fromFile () {
    return this.props.fromFile
  }

  get fromPath () {
    const { path, name } = this.fromFile
    return resolve(path, name)
  }

  get toPath () {
    return this.props.toPath
  }

  buildTempPath = () => {
    const { name, ext, base } = getFolderFromFilePath(this.fromPath, true)
    const tail = uid()
    const tempName = ext
      ? `${base}-${tail}.${ext}`
      : `${name}-${tail}`
    return resolve(window.pre.tempDir, tempName)
  }

  buildStep1Transfer = () => {
    const {
      title,
      tabType,
      sourceTabId,
      sourceHost
    } = this.props
    const transfer = {
      id: uid(),
      typeFrom: typeMap.remote,
      typeTo: typeMap.local,
      fromPath: this.fromPath,
      toPath: this.tempPath,
      tabId: sourceTabId,
      host: sourceHost,
      title,
      tabType,
      operation: '',
      remote2remoteStep: 1,
      remote2remoteId: this.id
    }
    return transfer
  }

  buildStep2Transfer = (fromFile) => {
    const {
      targetTabId,
      targetHost,
      targetTitle,
      targetTabType
    } = this.props
    const transfer = {
      id: uid(),
      typeFrom: typeMap.local,
      typeTo: typeMap.remote,
      fromPath: this.tempPath,
      toPath: this.toPath,
      fromFile,
      tabId: targetTabId,
      host: targetHost,
      title: targetTitle,
      tabType: targetTabType,
      operation: '',
      remote2remoteStep: 2,
      remote2remoteId: this.id,
      originalId: this.step1Transfer?.id
    }
    return transfer
  }

  start = () => {
    this.tempPath = this.buildTempPath()
    this.step1Transfer = this.buildStep1Transfer()
    this.store.addTransferList([copy(this.step1Transfer)])
    this.startWatch()
  }

  startWatch = () => {
    this.ref = autoRun(() => {
      this.tick()
      return this.store.transferHistory
    })
    this.ref.start()
  }

  stopWatch = () => {
    this.ref?.stop()
    this.ref = null
  }

  tick = async () => {
    const step1 = this.findHistory(this.step1Transfer?.id)

    if (!this.step2Transfer) {
      if (this.creatingStep2) {
        return
      }
      if (!step1) {
        return
      }
      if (step1.error) {
        return this.finish(step1.error)
      }
      this.creatingStep2 = true
      const localFromFile = await getLocalFileInfo(this.tempPath).catch(() => null)
      if (!localFromFile) {
        this.creatingStep2 = false
        return this.finish('local temp file/folder not found')
      }
      this.step2Transfer = this.buildStep2Transfer(localFromFile)
      this.creatingStep2 = false
      this.store.addTransferList([copy(this.step2Transfer)])
      return
    }

    const step2 = this.findHistory(this.step2Transfer.id)
    if (!step2) {
      return
    }

    return this.finish(step2.error)
  }

  findHistory = (transferId) => {
    if (!transferId) {
      return null
    }
    return this.store.transferHistory.find(item => {
      return item.id === transferId || item.originalId === transferId
    })
  }

  cleanup = async () => {
    if (!this.tempPath) {
      return
    }
    await fs.rmrf(this.tempPath).catch(() => {})
  }

  finish = async (error) => {
    if (this.finished) {
      return
    }
    this.finished = true
    this.stopWatch()
    await this.cleanup()
    this.props.onDone?.({
      id: this.id,
      error
    })
  }

  stop = async () => {
    await this.finish()
  }
}
