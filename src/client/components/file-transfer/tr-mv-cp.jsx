// tr-mv-cp.jsx
import TransferFile from './tr-file'
import { typeMap } from '../../common/constants'
import fs from '../../common/fs'
import resolve from '../../common/resolve'
import { refsStatic } from '../common/ref'

export default class TransferMvCp extends TransferFile {
  constructor(props) {
    super(props)
    this.id = 'tr-mv-cp-' + props.transfer.id
  }

  initTransfer = async () => {
    const conflict = await this.checkConflict()
    if (conflict) {
      this.setState({ status: 'conflict' })
      return
    }
    
    this.setState({ status: 'transferring' })
    this.startTime = Date.now()

    try {
      await this.performOperation()
      this.onEnd()
    } catch (err) {
      this.onError(err)
    }
  }

  performOperation = async () => {
    const { transfer } = this.props
    const { fromPath, toPath, file, typeFrom, typeTo, operation } = transfer

    const sourcePath = resolve(fromPath, file.name)
    const destPath = resolve(toPath, file.name)

    if (typeFrom === typeTo) {
      // Local to local or remote to remote
      if (typeFrom === typeMap.local) {
        await this.localOperation(operation, sourcePath, destPath)
      } else {
        await this.remoteOperation(operation, sourcePath, destPath)
      }
    } else {
      // Cross-type operations are not supported for mv/cp
      throw new Error('Cross-type mv/cp operations are not supported')
    }
  }

  localOperation = async (operation, sourcePath, destPath) => {
    if (operation === 'mv') {
      await fs.rename(sourcePath, destPath)
    } else if (operation === 'cp') {
      await fs.copy(sourcePath, destPath)
    }
  }

  remoteOperation = async (operation, sourcePath, destPath) => {
    const sftp = refsStatic.get('sftp-' + this.props.sessionId).sftp
    if (operation === 'mv') {
      await sftp.rename(sourcePath, destPath)
    } else if (operation === 'cp') {
      await sftp.copy(sourcePath, destPath)
    }
  }

  onData = (transferred) => {
    // For mv/cp operations, we don't have incremental progress
    // So we'll just update the state to show it's in progress
    this.setState({
      status: 'transferring',
      percent: 50  // Use an arbitrary value to show progress
    })
    this.props.onProgress && this.props.onProgress(this.id, this.state)
  }

  resolveConflict = (resolution) => {
    switch (resolution) {
      case 'overwrite':
      case 'merge':
        this.setState({ status: 'pending' }, this.initTransfer)
        break
      case 'rename':
        // Implement rename logic here
        // You might want to update the transfer object with a new name
        break
      case 'skip':
        this.onEnd()
        break
      case 'cancel':
        this.cancel()
        break
    }
  }
}