/**
 * Zmodem client handler for web terminal
 * Handles UI interactions and communicates with server-side zmodem
 */

import { throttle } from 'lodash-es'
import { filesize } from 'filesize'
import { TransferClientBase } from './transfer-client-base.js'
import { transferTypeMap } from '../../common/constants.js'

const ZMODEM_SAVE_PATH_KEY = 'zmodem-save-path'

/**
 * ZmodemClient class handles zmodem UI and client-side logic
 */
export class ZmodemClient extends TransferClientBase {
  constructor (terminal) {
    super(terminal, ZMODEM_SAVE_PATH_KEY)
    this.transferStartTime = 0
  }

  /**
   * Get the action name for this protocol
   * @returns {string}
   */
  getActionName () {
    return 'zmodem-event'
  }

  /**
   * Get protocol display name
   * @returns {string}
   */
  getProtocolDisplayName () {
    return 'ZMODEM'
  }

  /**
   * Handle server zmodem events
   * @param {Object} msg - Message from server
   */
  handleServerEvent (msg) {
    const { event } = msg

    switch (event) {
      case 'receive-start':
        this.onReceiveStart()
        break
      case 'send-start':
        this.onSendStart()
        break
      case 'file-start':
        this.onFileStart(msg.name, msg.size)
        break
      case 'file-prepared':
        this.onFilePrepared(msg.name, msg.path, msg.size)
        break
      case 'progress':
        this.onProgress(msg)
        break
      case 'file-complete':
        this.onFileComplete(msg.name, msg.path)
        break
      case 'file-skipped':
        this.onFileSkipped(msg.name, msg.message)
        break
      case 'session-end':
        this.onSessionEnd()
        break
    }
  }

  /**
   * Handle receive session start
   */
  async onReceiveStart () {
    this.isActive = true
    this.writeBanner('RECEIVE', 'Recommend use trzsz instead: https://github.com/trzsz/trzsz')

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
        event: 'cancel'
      })
      this.onSessionEnd()
    }
  }

  /**
   * Handle send session start
   */
  async onSendStart () {
    this.isActive = true
    this.writeBanner('SEND', 'Recommend use trzsz instead: https://github.com/trzsz/trzsz')

    // Ask user to select files
    const files = await this.openFileSelect()
    if (files && files.length > 0) {
      this.sendToServer({
        event: 'send-files',
        files
      })
    } else {
      // User cancelled, end session
      this.sendToServer({
        event: 'cancel'
      })
      this.onSessionEnd()
    }
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
   * Handle file prepared event (for receive)
   * @param {string} name - File name
   * @param {string} path - File path
   * @param {number} size - File size
   */
  onFilePrepared (name, path, size) {
    // Store the full path for display
    if (this.currentTransfer) {
      this.currentTransfer.path = path
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
   * Handle file skipped (already exists on remote side)
   * @param {string} name - File name
   * @param {string} message - Skip message
   */
  onFileSkipped (name, message) {
    this.writeToTerminal(`\r\n\x1b[33m\x1b[1mSKIPPED: ${name} - ${message}\x1b[0m\r\n`)
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
}

export default ZmodemClient
