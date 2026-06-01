/**
 * XMODEM client handler for web terminal
 * Handles UI interactions and communicates with server-side xmodem
 * Unlike zmodem/trzsz, XMODEM requires explicit user initiation
 */

import { throttle } from 'lodash-es'
import { filesize } from 'filesize'
import { TransferClientBase } from './transfer-client-base.js'
import { transferTypeMap } from '../../common/constants.js'

const XMODEM_SAVE_PATH_KEY = 'xmodem-save-path'

/**
 * XmodemClient class handles XMODEM UI and client-side logic
 */
export class XmodemClient extends TransferClientBase {
  constructor (terminal) {
    super(terminal, XMODEM_SAVE_PATH_KEY)
    this.transferStartTime = 0
    this.pendingMode = null // 'send' or 'receive' - waiting for user action
  }

  /**
   * Get the action name for this protocol
   * @returns {string}
   */
  getActionName () {
    return 'xmodem-event'
  }

  /**
   * Get protocol display name
   * @returns {string}
   */
  getProtocolDisplayName () {
    return 'XMODEM'
  }

  /**
   * Handle server xmodem events
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
      case 'progress':
        this.onProgress(msg)
        break
      case 'file-complete':
        this.onFileComplete(msg.name, msg.path)
        break
      case 'session-end':
        this.onSessionEnd()
        break
      case 'session-error':
        this.onError(msg.error)
        break
      case 'auto-trigger-receive':
        this.handleAutoReceive(msg.name)
        break
      case 'auto-trigger-send':
        this.handleAutoSend()
        break
    }
  }

  /**
   * Auto-triggered: device is sending a file, electerm should receive it.
   * Opens save folder dialog then starts xmodem receive.
   * @param {string} fileName - Original filename from the device
   */
  async handleAutoReceive (fileName) {
    if (this.isActive) return

    this.isActive = true
    this.writeBanner('RECEIVE', null)

    const savePath = await this.openSaveFolderSelect()
    if (savePath) {
      this.savePath = savePath
      this.sendToServer({
        event: 'start-receive'
      })
      this.sendToServer({
        event: 'set-save-path',
        path: savePath,
        name: fileName
      })
    } else {
      this.isActive = false
      this.writeToTerminal('\r\n\x1b[33mXMODEM Receive cancelled\x1b[0m\r\n')
    }
  }

  /**
   * Auto-triggered: device wants to receive a file, electerm should send it.
   * Opens file select dialog then starts xmodem send.
   */
  async handleAutoSend () {
    if (this.isActive) return

    this.isActive = true
    this.writeBanner('SEND', null)

    const files = await this.openFileSelect({
      title: 'Choose file to send via XMODEM',
      message: 'Choose file to send via XMODEM'
    })
    if (files && files.length > 0) {
      this.sendToServer({
        event: 'start-send'
      })
      this.sendToServer({
        event: 'send-files',
        files
      })
    } else {
      this.isActive = false
      this.writeToTerminal('\r\n\x1b[33mXMODEM Send cancelled\x1b[0m\r\n')
    }
  }

  /**
   * Initiate XMODEM receive from UI
   * User must have already started `sx` (or similar) on the remote device
   */
  async initiateReceive () {
    if (this.isActive) {
      this.writeToTerminal('\r\n\x1b[33m\x1b[1mXMODEM: Transfer already in progress\x1b[0m\r\n')
      return
    }

    this.isActive = true
    this.writeBanner('RECEIVE', null)

    // Ask user for save directory
    const savePath = await this.openSaveFolderSelect()
    if (savePath) {
      this.savePath = savePath
      this.sendToServer({
        event: 'start-receive'
      })
      // Also send save path
      this.sendToServer({
        event: 'set-save-path',
        path: savePath
      })
    } else {
      // User cancelled
      this.isActive = false
    }
  }

  /**
   * Initiate XMODEM send from UI
   * User must have already started `rx` (or similar) on the remote device
   */
  async initiateSend () {
    if (this.isActive) {
      this.writeToTerminal('\r\n\x1b[33m\x1b[1mXMODEM: Transfer already in progress\x1b[0m\r\n')
      return
    }

    this.isActive = true
    this.writeBanner('SEND', null)

    // Ask user to select files
    const files = await this.openFileSelect({
      title: 'Choose file(s) to send via XMODEM',
      message: 'Choose file(s) to send via XMODEM'
    })
    if (files && files.length > 0) {
      this.sendToServer({
        event: 'start-send'
      })
      // Also send files
      this.sendToServer({
        event: 'send-files',
        files
      })
    } else {
      // User cancelled
      this.isActive = false
    }
  }

  /**
   * Handle receive session start (from server)
   */
  onReceiveStart () {
    // Server confirmed it's ready to receive
    this.writeToTerminal('\r\n\x1b[36mWaiting for remote to start sending file...\x1b[0m\r\n')
  }

  /**
   * Handle send session start (from server)
   */
  onSendStart () {
    // Server confirmed it's ready to send
    this.writeToTerminal('\r\n\x1b[36mWaiting for remote to request file (NAK/C)...\x1b[0m\r\n')
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
    this.currentTransfer.serverSpeed = msg.speed
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
      this.currentTransfer.transferred = this.currentTransfer.size || this.currentTransfer.transferred
      this.currentTransfer.path = path
      this._doWriteProgress(true)
      this.writeToTerminal('\r\n')
      this._prevProgressRows = 0
    }
    this.currentTransfer = null
  }

  /**
   * Handle error from server
   * @param {string} error - Error message
   */
  onError (error) {
    this.writeToTerminal(`\r\n\x1b[31m\x1b[1mXMODEM Error: ${error}\x1b[0m\r\n`)
  }

  /**
   * Write progress to terminal (throttled)
   */
  writeProgress = throttle((isComplete = false) => {
    this._doWriteProgress(isComplete)
  }, 500)

  /**
   * Internal function to actually write progress
   */
  _doWriteProgress (isComplete = false) {
    if (!this.currentTransfer || !this.terminal?.term) return

    const { name, size, transferred, path, serverSpeed } = this.currentTransfer
    const speed = serverSpeed || 0
    const displayName = path || name
    const formatSize = (bytes) => filesize(bytes)

    this.writeProgressBar({
      name: displayName,
      size,
      transferred,
      speed,
      isComplete,
      formatSize
    })
  }
}

export default XmodemClient
