import { pick } from 'lodash-es'
import { notification } from '../../common/notification'
import ShowItem from '../../common/show-item.jsx'
import { refs } from '../../common/ref.js'
import { startTerminalLogFile, toggleTerminalLog } from '../terminal-apis.js'
import { getFolderFromFilePath } from '../../sftp/file-read.js'

const e = window.translate

/**
 * Session logging / recording: dumping the buffer to disk and keeping the
 * timestamped log file running.
 */
export const logMixin = {
  syncTermInfo (stateUpdate) {
    this.setState(stateUpdate)
    const infoUpdate = pick(stateUpdate, ['saveTerminalLogToFile', 'addTimeStampToTermLog', 'logPath', 'logFileName'])
    if (Object.keys(infoUpdate).length) {
      refs.get('term-info-' + this.props.tab.id)?.setState(infoUpdate)
    }
  },

  async openLogSaveDialog (titleKey) {
    const { logName } = this.props
    const result = await window.api.saveDialog({
      title: e(titleKey),
      defaultPath: logName + '.log',
      filters: [
        { name: 'Log files', extensions: ['log'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    return result.filePath
  },

  async onSaveTerminalLog () {
    const filePath = await this.openLogSaveDialog('saveTerminalLogToFile')
    if (!filePath) {
      return
    }
    const content = this.getTerminalBufferText()
    await window.fs.writeFile(filePath, content).catch(window.store.onError)
    const { addTimeStampToTermLog } = this.state
    startTerminalLogFile(this.pid, filePath, addTimeStampToTermLog).catch(window.store.onError)
    const { path: logPath, name: logFileName } = getFolderFromFilePath(filePath, false)
    this.syncTermInfo({ saveTerminalLogToFile: true, logPath, logFileName })
    notification.success({
      message: e('saveTerminalLogToFile'),
      description: <ShowItem to={filePath}>{filePath}</ShowItem>,
      duration: 5
    })
  },

  async onRecord () {
    const filePath = await this.openLogSaveDialog('record')
    if (!filePath) {
      return
    }
    const { addTimeStampToTermLog } = this.state
    startTerminalLogFile(this.pid, filePath, addTimeStampToTermLog).catch(window.store.onError)
    const { path: logPath, name: logFileName } = getFolderFromFilePath(filePath, false)
    this.syncTermInfo({ saveTerminalLogToFile: true, logPath, logFileName })
    this.setState({ recording: true, recordingFilePath: filePath })
    notification.success({
      message: e('record'),
      description: <ShowItem to={filePath}>{filePath}</ShowItem>,
      duration: 5
    })
  },

  onStopRecord () {
    const { recordingFilePath } = this.state
    toggleTerminalLog(this.pid).catch(window.store.onError)
    this.syncTermInfo({ saveTerminalLogToFile: false })
    this.setState({ recording: false, recordingFilePath: '' })
    notification.success({
      message: e('stopRecord'),
      description: <ShowItem to={recordingFilePath}>{recordingFilePath}</ShowItem>
    })
  },

  handleShowInfo () {
    const { logName, tab } = this.props
    const infoProps = {
      logName,
      id: tab.id,
      pid: tab.id,
      isRemote: this.isRemote(),
      isActive: this.isActiveTerminal()
    }
    Object.assign(window.store.terminalInfoProps, infoProps)
  }
}
