/**
 * File transfer handler component
 * Handles single file upload/download with conflict resolution
 */
import { Component } from 'react'
import {
  typeMap,
  fileOperationsMap,
  transferTypeMap
} from '../../common/constants'
import { getLocalFileInfo, getRemoteFileInfo } from './file-read'
import format, { computeLeftTime, computePassedTime } from './transfer-speed-format'
import { refs } from '../common/ref'
import resolve from '../../common/resolve'
import generate from '../../common/uid'
import fs from '../../common/fs'

export default class TransferFile extends Component {
  constructor(props) {
    super(props)
    // this.state = {
    //   status: 'init', // init, checking, transferring, paused, finished, error
    //   conflictResolution: '', // '', 'rename', 'overwrite', 'skip'
    //   transferred: 0,
    //   speed: 0,
    //   startTime: 0
    // }
    this.sessionId = props.transfer.sessionId
  }

  componentDidMount() {
    if (this.props.inited) {
      this.start()
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.inited && this.props.inited) {
      this.start()
    }
    if (!prevProps.pausing && this.props.pausing) {
      this.pause()
    }
    if (prevProps.pausing && !this.props.pausing) {
      this.resume()
    }
  }

  componentWillUnmount() {
    this.destroy()
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

  start = async () => {
    if (this.started) {
      return
    }
    const { transfer } = this.props
    const {
      typeFrom,
      typeTo,
      fromPath,
      toPath,
      fromFile: {
        isDirectory
      },
      action,
      inited,
      operation
    } = transfer
    if (
      typeFrom === typeTo &&
      fromPath === toPath &&
      operation === fileOperationsMap.mv
    ) {
      return this.destroy()
    }
    const t = Date.now()
    this.update({
      startTime: t
    })
    this.startTime = t
    this.started = true

    const fromFile = tr.fromFile
      ? tr.fromFile
      : await this.checkExist(typeFrom, fromPath, sessionId)
    if (!fromFile) {
      return this.tagTransferError(id, 'file not exist')
    }

    const { transfer } = this.props
    this.setState({
      status: 'checking',
      startTime: Date.now()
    })

    // Check for conflict before starting transfer
    const hasConflict = await this.checkConflict()
    if (hasConflict) {
      return
    }

    this.startTransfer()
  }

  checkConflict = async () => {
    const { transfer } = this.props
    const { typeTo, toPath, fromFile } = transfer
    const targetPath = resolve(toPath, fromFile.name)

    try {
      let exists
      if (typeTo === typeMap.local) {
        exists = await getLocalFileInfo(targetPath)
      } else {
        const sftp = refs.get('sftp-' + this.sessionId).sftp
        exists = await getRemoteFileInfo(sftp, targetPath)
      }

      if (exists) {
        this.setState({ status: 'paused' })
        // Notify parent about conflict
        this.props.onConflict?.({
          sourceFile: fromFile,
          targetFile: exists,
          targetPath
        })
        return true
      }
      return false
    } catch (e) {
      this.handleError(e)
      return true
    }
  }

  startTransfer = async () => {
    const { transfer } = this.props
    const { typeTo, typeFrom, fromPath, toPath, fromFile } = transfer

    try {
      this.setState({ status: 'transferring' })

      const isDownload = typeFrom === typeMap.remote
      const sftp = refs.get('sftp-' + this.sessionId).sftp
      
      // Determine paths based on any rename from conflict resolution
      const sourcePath = resolve(fromPath, fromFile.name)
      const targetPath = this.state.conflictResolution === 'rename'
        ? resolve(toPath, `${fromFile.name}_${generate()}`)
        : resolve(toPath, fromFile.name)

      const transferType = isDownload ? 'download' : 'upload'
      
      this.transfer = await sftp[transferType]({
        remotePath: isDownload ? sourcePath : targetPath,
        localPath: isDownload ? targetPath : sourcePath,
        options: { mode: fromFile.mode },
        onData: this.handleProgress,
        onError: this.handleError,
        onEnd: this.handleComplete
      })
    } catch (e) {
      this.handleError(e)
    }
  }

  handleProgress = (transferred) => {
    if (this.state.status !== 'transferring') return

    const { fromFile } = this.props.transfer
    const total = fromFile.size
    const now = Date.now()
    
    this.setState({
      transferred,
      speed: format(transferred, this.state.startTime),
      ...computeLeftTime(transferred, total, this.state.startTime)
    })

    // Update parent with progress
    this.props.onProgress?.({
      percent: Math.floor(100 * transferred / total),
      transferred,
      total,
      speed: this.state.speed,
      leftTime: this.state.leftTime
    })
  }

  handleError = (error) => {
    this.setState({ 
      status: 'error',
      error: error.message
    })
    this.props.onError?.(error)
  }

  handleComplete = () => {
    this.setState({ status: 'finished' })
    this.props.onComplete?.({
      startTime: this.state.startTime,
      endTime: Date.now(),
      speed: this.state.speed,
      size: this.props.transfer.fromFile.size
    })
  }

  pause = () => {
    if (this.transfer && this.state.status === 'transferring') {
      this.transfer.pause()
      this.setState({ status: 'paused' })
    }
  }

  resume = () => {
    if (this.transfer && this.state.status === 'paused') {
      this.transfer.resume()
      this.setState({ status: 'transferring' })
    }
  }

  // Handle conflict resolution from parent
  resolveConflict = (resolution) => {
    this.setState({ 
      conflictResolution: resolution,
      status: 'init'
    }, () => {
      if (resolution === 'skip') {
        this.handleComplete()
      } else {
        this.startTransfer()
      }
    })
  }

  destroy = () => {
    if (this.transfer) {
      this.transfer.destroy()
      this.transfer = null
    }
  }

  render() {
    return null
  }
}