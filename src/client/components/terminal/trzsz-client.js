/**
 * Trzsz client handler for web terminal
 * Handles UI interactions and communicates with server-side trzsz
 */

import { throttle } from 'lodash-es'
import { filesize } from 'filesize'
import { TransferClientBase } from './transfer-client-base.js'
import { transferTypeMap } from '../../common/constants.js'

const TRZSZ_SAVE_PATH_KEY = 'trzsz-save-path'

/**
 * TrzszClient class handles trzsz UI and client-side logic
 */
export class TrzszClient extends TransferClientBase {
  constructor (terminal) {
    super(terminal, TRZSZ_SAVE_PATH_KEY)
    this.transferStartTime = 0
    this.totalTransferred = 0
    this.totalSpeed = 0
  }

  /**
   * Get the action name for this protocol
   * @returns {string}
   */
  getActionName () {
    return 'trzsz-event'
  }

  /**
   * Get protocol display name
   * @returns {string}
   */
  getProtocolDisplayName () {
    return 'TRZSZ'
  }

  /**
   * Handle server trzsz events
   * @param {Object} msg - Message from server
   */
  handleServerEvent (msg) {
    const { event } = msg

    // Ignore events that arrive after the session has already ended
    // (e.g. async error from cancelled transfer)
    if (!this.isActive && event !== 'receive-start' && event !== 'send-start') {
      return
    }

    switch (event) {
      case 'receive-start':
        this.onReceiveStart()
        break
      case 'send-start':
        this.onSendStart(msg.directory)
        break
      case 'file-count':
        this.onFileCount(msg.count)
        break
      case 'file-start':
        this.onFileStart(msg.name, msg.size)
        break
      case 'file-size':
        this.onFileSize(msg.name, msg.size)
        break
      case 'progress':
        this.onProgress(msg)
        break
      case 'file-complete':
        this.onFileComplete(msg.name, msg.path)
        break
      case 'session-complete':
        this.onSessionComplete(msg)
        break
      case 'session-error':
        this.onError(msg.error)
        break
      case 'session-end':
        this.onSessionEnd()
        break
    }
  }

  /**
   * Handle receive session start (download from remote)
   */
  async onReceiveStart () {
    this.isActive = true
    this.writeBanner('RECEIVE')

    // Ask user for save directory
    const savePath = await this.openSaveFolderSelect()
    if (savePath) {
      this.savePath = savePath
      this.sendToServer({
        event: 'set-save-path',
        path: savePath
      })
    } else {
      // User cancelled, end session
      this.sendToServer({
        event: 'set-save-path',
        path: null
      })
      this.onSessionEnd()
    }
  }

  /**
   * Handle send session start (upload to remote)
   * @param {boolean} directory - Whether to select directories
   */
  async onSendStart (directory = false) {
    this.isActive = true
    this.writeBanner('SEND')

    // Ask user to select files or directories
    const files = await this.openFileSelect({
      directory,
      title: directory ? 'Choose directories to send' : 'Choose some files to send',
      message: directory ? 'Choose directories to send' : 'Choose some files to send'
    })

    if (files && files.length > 0) {
      this.sendToServer({
        event: 'send-files',
        files
      })
    } else {
      // User cancelled, end session
      this.sendToServer({
        event: 'send-files',
        files: []
      })
      this.onSessionEnd()
    }
  }

  /**
   * Handle file count event
   * @param {number} count - Number of files
   */
  onFileCount (count) {
    this.writeToTerminal(`\r\n\x1b[36mReceiving ${count} file${count > 1 ? 's' : ''}...\x1b[0m\r\n`)
  }

  /**
   * Handle file start event
   * @param {string} name - File name
   * @param {number} size - File size
   */
  onFileStart (name, size) {
    this.currentTransfer = {
      name,
      size,
      transferred: 0,
      type: this.savePath ? transferTypeMap.download : transferTypeMap.upload,
      path: null
    }
    this.transferStartTime = Date.now()
    this.writeProgress()
  }

  /**
   * Handle file size event
   * @param {string} name - File name
   * @param {number} size - File size
   */
  onFileSize (name, size) {
    if (this.currentTransfer) {
      this.currentTransfer.size = size
    }
  }

  /**
   * Handle progress update
   * @param {Object} msg - Progress message
   */
  onProgress (msg) {
    if (!this.currentTransfer) {
      this.currentTransfer = {
        name: msg.name,
        size: msg.size,
        transferred: 0,
        type: msg.type,
        path: msg.path || null
      }
      this.transferStartTime = Date.now()
    }

    this.currentTransfer.transferred = msg.transferred
    this.currentTransfer.serverSpeed = msg.speed // Use server's speed calculation
    this.currentTransfer.path = msg.path || this.currentTransfer.path
    this.writeProgress()
  }

  /**
   * Handle file complete
   * @param {string} name - File name
   * @param {string} path - File path
   */
  onFileComplete (name, path) {
    if (this.currentTransfer) {
      this.currentTransfer.transferred = this.currentTransfer.size
      this.currentTransfer.path = path
      // Call directly to ensure 100% is displayed immediately
      this._doWriteProgress(true)
      // Add newline after completion
      this.writeToTerminal('\r\n')
    }
    this.currentTransfer = null
  }

  /**
   * Write progress to terminal (throttled for updates, immediate for completion)
   * @param {boolean} isComplete - Whether this is the final completion display
   */
  writeProgress = throttle((isComplete = false) => {
    this._doWriteProgress(isComplete)
  }, 500)

  /**
   * Internal function to actually write progress
   * @param {boolean} isComplete - Whether this is the final completion display
   */
  _doWriteProgress (isComplete = false) {
    if (!this.currentTransfer || !this.terminal?.term) return

    const { name, size, transferred, path, serverSpeed } = this.currentTransfer
    const percent = size > 0 ? Math.floor(transferred * 100 / size) : 100

    // Use server's speed if available, otherwise calculate locally
    const speed = serverSpeed || 0

    // Use full path if available, otherwise just name
    const displayName = path || name

    // filesize expects bytes and formats to human readable
    const formatSize = (bytes) => filesize(bytes)

    // Clear line and write progress
    const str = `\r\x1b[2K\x1b[32m${displayName}\x1b[0m: ${percent}%, ${formatSize(transferred)}/${formatSize(size)}, ${formatSize(speed)}/s${isComplete ? ' \x1b[32m\x1b[1m[DONE]\x1b[0m' : ''}`
    this.writeToTerminal(str + '\r')
  }

  /**
   * Handle session complete
   * @param {Object} msg - Completion message with files and savePath
   */
  onSessionComplete (msg) {
    // Add newline to preserve progress display
    this.writeToTerminal('\r\n')

    // Display completion message
    if (msg.message) {
      this.writeToTerminal(`\x1b[32m\x1b[1m${msg.message}\x1b[0m\r\n`)
    }

    // Display saved files for download
    if (msg.files && msg.files.length > 0) {
      const fileCount = msg.files.length
      const savePath = msg.savePath || ''

      // Format file size
      const formatSize = (bytes) => filesize(bytes)

      // Display total transfer info
      if (msg.totalBytes && msg.totalBytes > 0) {
        const totalSize = formatSize(msg.totalBytes)
        const elapsed = msg.totalElapsed ? msg.totalElapsed.toFixed(1) : '0.0'
        const speed = msg.avgSpeed ? formatSize(msg.avgSpeed) : '0 B'
        this.writeToTerminal(`\x1b[32m\x1b[1mTransferred ${fileCount} ${fileCount > 1 ? 'files' : 'file'} (${totalSize}) in ${elapsed}s, avg speed: ${speed}/s\x1b[0m\r\n`)
      } else {
        this.writeToTerminal(`\x1b[32m\x1b[1mSaved ${fileCount} ${fileCount > 1 ? 'files' : 'file'}\x1b[0m\r\n`)
      }

      if (savePath) {
        this.writeToTerminal(`\x1b[36mDestination: ${savePath}\x1b[0m\r\n`)
      }

      // Display file list with sizes
      if (msg.completedFiles && msg.completedFiles.length > 0) {
        for (const file of msg.completedFiles) {
          const sizeStr = file.size ? ` (${formatSize(file.size)})` : ''
          this.writeToTerminal(`  - ${file.name}${sizeStr}\r\n`)
        }
      } else {
        // Fallback to just file names
        for (const file of msg.files) {
          const fileName = file.split('/').pop().split('\\').pop()
          this.writeToTerminal(`  - ${fileName}\r\n`)
        }
      }
    }

    this.onSessionEnd()
  }

  /**
   * Handle error
   * @param {string} message - Error message
   */
  onError (message) {
    this.writeToTerminal(`\r\n\x1b[31m\x1b[1mTRZSZ Error: ${message}\x1b[0m\r\n`)
    this.onSessionEnd()
  }
}

export default TrzszClient
