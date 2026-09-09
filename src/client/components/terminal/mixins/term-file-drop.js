import resolve from '../../../common/resolve.js'
import message from '../../common/message'
import { getFilePath, isUnsafeFilename } from '../../../common/file-drop-utils.js'
import { connectionMap } from '../../../common/constants.js'

/**
 * Files dropped onto the terminal: either quoted paths typed into the shell,
 * or an upload through trzsz / zmodem / xmodem for ssh and serial sessions.
 */
export const fileDropMixin = {
  onDrop (e) {
    const dt = e.dataTransfer
    const fromFile = dt.getData('fromFile')
    const notSafeMsg = 'File name contains unsafe characters'
    const isSshTerminal = this.props.tab.type === connectionMap.ssh
    const isSerialTerminal = this.props.tab.type === connectionMap.serial

    if (fromFile) {
      try {
        const fileData = JSON.parse(fromFile)
        const filePath = resolve(fileData.path, fileData.name)
        if (isUnsafeFilename(filePath)) {
          message.error(notSafeMsg)
          return
        }
        if (isSshTerminal) {
          const behavior = this.props.config.dragDropBehavior || 'ask'
          if (behavior === 'ask') {
            this.setState({
              dropFileModalVisible: true,
              droppedFiles: [{ path: filePath, isRemote: true }]
            })
          } else {
            this.handleDropFileAction(behavior, [{ path: filePath, isRemote: true }])
          }
          return
        }
        if (isSerialTerminal) {
          this.setState({
            dropFileModalVisible: true,
            droppedFiles: [{ path: filePath, isRemote: false }]
          })
          return
        }
        this.attachAddon._sendData(`"${filePath}" `)
        return
      } catch (e) {
        console.error('Failed to parse fromFile data:', e)
      }
    }

    const files = dt.files
    if (files && files.length) {
      const arr = Array.from(files)
      const filePaths = arr.map(f => getFilePath(f))

      const hasUnsafeFilename = filePaths.some(path => isUnsafeFilename(path))
      if (hasUnsafeFilename) {
        message.error(notSafeMsg)
        return
      }

      if (isSshTerminal) {
        const behavior = this.props.config.dragDropBehavior || 'ask'
        if (behavior === 'ask') {
          this.setState({
            dropFileModalVisible: true,
            droppedFiles: filePaths.map(path => ({ path, isRemote: false }))
          })
        } else {
          this.handleDropFileAction(behavior, filePaths.map(path => ({ path, isRemote: false })))
        }
        return
      }

      if (isSerialTerminal) {
        this.setState({
          dropFileModalVisible: true,
          droppedFiles: filePaths.map(path => ({ path, isRemote: false }))
        })
        return
      }

      const filesAll = filePaths.map(path => `"${path}"`).join(' ')
      this.attachAddon._sendData(filesAll)
    }
  },

  handleDropFileModalCancel () {
    this.setState({
      dropFileModalVisible: false,
      droppedFiles: []
    })
  },

  handleDropFileAction (action, filesOverride) {
    const droppedFiles = filesOverride || this.state.droppedFiles
    if (!droppedFiles || !droppedFiles.length) {
      this.handleDropFileModalCancel()
      return
    }

    const filePaths = droppedFiles.map(f => f.path)

    switch (action) {
      case 'trz': {
        if (this.trzszClient && this.trzszClient.isActive) {
          message.warning('A transfer is already in progress')
          this.handleDropFileModalCancel()
          return
        }
        window._apiControlSelectFile = filePaths
        this.attachAddon._sendData('trz\r')
        break
      }
      case 'rz':{
        if (this.zmodemClient && this.zmodemClient.isActive) {
          message.warning('A transfer is already in progress')
          this.handleDropFileModalCancel()
          return
        }
        window._apiControlSelectFile = filePaths
        this.attachAddon._sendData('rz\r')
        break
      }
      case 'xmodem': {
        if (this.xmodemClient && this.xmodemClient.isActive) {
          message.warning('A transfer is already in progress')
          this.handleDropFileModalCancel()
          return
        }
        // Use XMODEM send with the dropped files
        window._apiControlSelectFile = filePaths
        if (this.xmodemClient) {
          this.xmodemClient.initiateSend()
        }
        break
      }
      case 'inputOnly':
      default: {
        const filesAll = filePaths.map(path => `"${path}"`).join(' ')
        this.attachAddon._sendData(filesAll)
        break
      }
    }

    this.handleDropFileModalCancel()
  }
}
