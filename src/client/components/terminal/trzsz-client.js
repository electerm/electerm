/**
 * Trzsz client handler for web terminal
 * Handles UI interactions and communicates with server-side trzsz
 */

import { TransferClientBase } from './transfer-client-base.js'

const TRZSZ_SAVE_PATH_KEY = 'trzsz-save-path'

/**
 * TrzszClient class handles trzsz UI and client-side logic
 */
export class TrzszClient extends TransferClientBase {
  constructor (terminal) {
    super(terminal, TRZSZ_SAVE_PATH_KEY)
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

    switch (event) {
      case 'receive-start':
        this.onReceiveStart()
        break
      case 'send-start':
        this.onSendStart(msg.directory)
        break
      case 'session-complete':
        this.onSessionComplete(msg.message)
        break
      case 'error':
        this.onError(msg.message)
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
   * Handle session complete
   * @param {string} message - Completion message
   */
  onSessionComplete (message) {
    if (message) {
      this.writeToTerminal(`\r\n\x1b[32m\x1b[1m${message}\x1b[0m\r\n`)
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
