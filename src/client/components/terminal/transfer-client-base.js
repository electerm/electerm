/**
 * Base class for file transfer clients (zmodem, trzsz, etc.)
 * Provides common functionality for UI interactions and server communication
 */

// import { transferTypeMap } from '../../common/constants.js'
import { getLocalFileInfo } from '../sftp/file-read.js'

/**
 * TransferClientBase class - abstract base for file transfer protocols
 */
export class TransferClientBase {
  constructor (terminal, storageKey) {
    this.terminal = terminal
    this.storageKey = storageKey
    this.socket = null
    this.isActive = false
    this.currentTransfer = null
    this.savePath = null
    this.messageHandler = null
    this._prevProgressRows = 0
  }

  /**
   * Initialize client with socket
   * @param {WebSocket} socket - WebSocket connection
   */
  init (socket) {
    this.socket = socket
    this.setupMessageHandler()
  }

  /**
   * Setup message handler for events from server
   * Should be overridden by subclass
   */
  setupMessageHandler () {
    if (!this.socket) return

    this.messageHandler = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data)
          if (msg.action === this.getActionName()) {
            this.handleServerEvent(msg)
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
    }
    this.socket.addEventListener('message', this.messageHandler)
  }

  /**
   * Get the action name for this protocol
   * Should be overridden by subclass
   * @returns {string}
   */
  getActionName () {
    throw new Error('getActionName must be implemented by subclass')
  }

  /**
   * Handle server events
   * Should be overridden by subclass
   * @param {Object} msg - Message from server
   */
  handleServerEvent (msg) {
    throw new Error('handleServerEvent must be implemented by subclass')
  }

  /**
   * Send message to server
   * @param {Object} msg - Message to send
   */
  sendToServer (msg) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        action: this.getActionName(),
        ...msg
      }))
    }
  }

  /**
   * Write text to terminal
   * @param {string} text - Text to write
   */
  writeToTerminal (text) {
    if (this.terminal && this.terminal.term) {
      this.terminal.term.write(text)
    }
  }

  /**
   * Write banner to terminal
   * @param {string} type - 'RECEIVE' or 'SEND'
   * @param {string} protocolName - Protocol name for display
   */
  writeBanner (type, protocolName) {
    const border = '='.repeat(50)
    this.writeToTerminal(`\r\n${border}\r\n`)
    if (protocolName) {
      this.writeToTerminal(`\x1b[33m\x1b[1m${protocolName}\x1b[0m\r\n`)
      this.writeToTerminal(`${border}\r\n\r\n`)
    }
    this.writeToTerminal(`\x1b[32m\x1b[1m${this.getProtocolDisplayName()}::${type}::START\x1b[0m\r\n`)
  }

  /**
   * Write progress bar to terminal
   * @param {Object} options - Progress options
   * @param {string} options.name - File name
   * @param {number} options.size - Total size in bytes
   * @param {number} options.transferred - Transferred bytes
   * @param {number} options.speed - Transfer speed in bytes/s
   * @param {boolean} options.isComplete - Whether transfer is complete
   * @param {Function} options.formatSize - Function to format size
   * @returns {string} The progress string written to terminal
   */
  writeProgressBar ({ name, size, transferred, speed, isComplete = false, formatSize = (b) => b }) {
    const percent = size > 0 ? Math.floor(transferred * 100 / size) : 100
    const barWidth = 30
    const filledWidth = Math.floor(percent / 100 * barWidth)
    const emptyWidth = barWidth - filledWidth

    const bar = '\x1b[32m' + '\u2588'.repeat(filledWidth) + '\x1b[90m' + '\u2591'.repeat(emptyWidth) + '\x1b[0m'

    const sizeStr = `${formatSize(transferred)}/${formatSize(size)}`
    const speedStr = speed > 0 ? `, ${formatSize(speed)}/s` : ''
    const doneStr = isComplete ? ' \x1b[32m\x1b[1m[DONE]\x1b[0m' : ''

    const str = `\x1b[32m${name}\x1b[0m: ${percent}% ${bar} ${sizeStr}${speedStr}${doneStr}`

    // Calculate visible length (no ANSI codes) to detect line wrapping
    const visibleLen = name.length + 2 + String(percent).length + 2 + barWidth + 1 + sizeStr.length + speedStr.length + (isComplete ? 7 : 0)
    const cols = this.terminal?.term?.cols || 80
    const currentRows = Math.max(1, Math.ceil(visibleLen / cols))

    // Move cursor back up to the start of the previous progress block, then
    // erase everything from there to end-of-display so wrapped lines are gone.
    let clearSeq = '\r'
    for (let i = 0; i < this._prevProgressRows; i++) {
      clearSeq += '\x1b[A' // cursor up one row
    }
    clearSeq += '\x1b[J' // erase from cursor to end of display

    this._prevProgressRows = currentRows - 1
    this.writeToTerminal(clearSeq + str + '\r')
    return str
  }

  /**
   * Get protocol display name
   * Should be overridden by subclass
   * @returns {string}
   */
  getProtocolDisplayName () {
    return 'TRANSFER'
  }

  /**
   * Handle session end
   */
  onSessionEnd () {
    this.isActive = false
    this.currentTransfer = null
    this.savePath = null
    if (this.terminal && this.terminal.term) {
      this.terminal.term.focus()
      this.terminal.term.write('\r\n')
    }
  }

  /**
   * Open file select dialog
   * @param {Object} options - Options for file selection
   * @returns {Promise<Array>} - Selected files
   */
  openFileSelect = async (options = {}) => {
    const {
      directory = false,
      title = 'Choose some files to send',
      message = 'Choose some files to send'
    } = options

    const properties = [
      directory ? 'openDirectory' : 'openFile',
      'multiSelections',
      'showHiddenFiles',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ]

    const files = await window.api.openDialog({
      title,
      message,
      properties
    }).catch(() => false)

    if (!files || !files.length) {
      return null
    }

    const r = []
    for (const filePath of files) {
      const stat = await getLocalFileInfo(filePath)
      r.push({ ...stat, filePath, path: filePath })
    }
    return r
  }

  /**
   * Open save folder select dialog
   * @returns {Promise<string>} - Selected folder path
   */
  openSaveFolderSelect = async () => {
    // Try to use last saved path
    const lastPath = this.storageKey ? window.localStorage.getItem(this.storageKey) : null

    const savePaths = await window.api.openDialog({
      title: 'Choose a folder to save file(s)',
      message: 'Choose a folder to save file(s)',
      defaultPath: lastPath || undefined,
      properties: [
        'openDirectory',
        'showHiddenFiles',
        'createDirectory',
        'noResolveAliases',
        'treatPackageAsDirectory',
        'dontAddToRecent'
      ]
    }).catch(() => false)

    if (!savePaths || !savePaths.length) {
      return null
    }

    // Save for next time
    if (this.storageKey) {
      window.localStorage.setItem(this.storageKey, savePaths[0])
    }
    return savePaths[0]
  }

  /**
   * Cancel ongoing transfer
   */
  cancel () {
    if (!this.isActive) return
    this.writeToTerminal(`\r\n\x1b[33m\x1b[1m${this.getProtocolDisplayName()} transfer cancelled by user\x1b[0m\r\n`)
    this.sendToServer({
      event: 'cancel'
    })
    this.onSessionEnd()
  }

  /**
   * Clean up resources
   */
  destroy () {
    if (this.socket && this.messageHandler) {
      this.socket.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
    this.isActive = false
    this.currentTransfer = null
    this.savePath = null
    this.socket = null
    this.terminal = null
  }
}

export default TransferClientBase
