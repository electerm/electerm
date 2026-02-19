/**
 * Trzsz protocol handler for server-side terminal sessions
 * Uses trzsz2 (pure JS) for protocol implementation
 */

const fs = require('fs')
const path = require('path')
const log = require('../common/log')

// Import trzsz2 (pure JS protocol implementation)
const { TrzszTransfer } = require('trzsz2')

// Trzsz state constants
const TRZSZ_STATE = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path'
}

// Trzsz magic key prefix for detection
const TRZSZ_MAGIC_KEY_PREFIX = '::TRZSZ:TRANSFER:'
const TRZSZ_MAGIC_KEY_REGEXP = /::TRZSZ:TRANSFER:([SRD]):(\d+\.\d+\.\d+)(:\d+)?/

/**
 * FileReader - TrzszFileReader implementation for reading files from disk
 */
class FileReader {
  constructor (filePath, fileName) {
    this.filePath = filePath
    this.fileName = fileName
    this.fd = null
    this.size = 0
    this.offset = 0
    this.pathId = 0
    this.relPath = [fileName]
    this.isDirectory = false
  }

  /**
   * Open the file for reading
   */
  open () {
    const stats = fs.statSync(this.filePath)
    this.size = stats.size
    this.fd = fs.openSync(this.filePath, 'r')
  }

  getPathId () {
    return this.pathId
  }

  getRelPath () {
    return this.relPath
  }

  isDir () {
    return this.isDirectory
  }

  getSize () {
    return this.size
  }

  /**
   * Read file data
   * @param {ArrayBuffer} buf - Buffer to read into
   * @returns {Promise<Uint8Array>} - Data read from file
   */
  async readFile (buf) {
    const buffer = Buffer.from(buf)
    const bytesRead = fs.readSync(this.fd, buffer, 0, buffer.length, this.offset)
    this.offset += bytesRead
    return new Uint8Array(buffer.slice(0, bytesRead))
  }

  closeFile () {
    if (this.fd !== null) {
      fs.closeSync(this.fd)
      this.fd = null
    }
  }
}

/**
 * FileWriter - TrzszFileWriter implementation for writing files to disk
 */
class FileWriter {
  constructor (filePath, fileName) {
    this.filePath = filePath
    this.fileName = fileName
    this.localName = fileName
    this.isDirectory = false
    this.writeStream = null
  }

  getFileName () {
    return this.fileName
  }

  getLocalName () {
    return this.localName
  }

  isDir () {
    return this.isDirectory
  }

  /**
   * Write data to file
   * @param {Uint8Array} buf - Data to write
   */
  async writeFile (buf) {
    if (this.writeStream === null) {
      this.writeStream = fs.createWriteStream(this.filePath)
    }
    return new Promise((resolve, reject) => {
      this.writeStream.write(Buffer.from(buf), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * Delete the file
   */
  async deleteFile () {
    if (this.writeStream !== null) {
      this.writeStream.close()
      this.writeStream = null
    }
    return this.filePath
  }

  closeFile () {
    if (this.writeStream !== null) {
      this.writeStream.close()
      this.writeStream = null
    }
  }
}

/**
 * TrzszSession class handles trzsz file transfers for a terminal session
 */
class TrzszSession {
  constructor (term, ws) {
    this.term = term
    this.ws = ws
    this.state = TRZSZ_STATE.IDLE
    this.transfer = null
    this.currentTransfer = null
    this.downloadPath = null
    this.uploadPath = null
    this.transferSize = 0
    this.transferredBytes = 0
    this.startTime = 0
    this.savePath = null
    this.pendingFiles = []
    this.fileReaders = []
    this.fileWriters = []
    this.pendingData = []
    this.transferPromise = null
    this.lastProgressUpdate = 0
    this._pendingComplete = null
  }

  /**
   * Check if data contains trzsz magic key
   * @param {Buffer|string} data - Data to check
   * @returns {Object|null} - { type: 'receive'|'send', offset: number } or null
   */
  detectTrzszStart (data) {
    let str = data
    if (Buffer.isBuffer(data)) {
      str = data.toString('binary')
    }

    const idx = str.lastIndexOf(TRZSZ_MAGIC_KEY_PREFIX)
    if (idx < 0) return null

    const buffer = str.substring(idx)
    const found = buffer.match(TRZSZ_MAGIC_KEY_REGEXP)
    if (!found) return null

    const direction = found[1]
    if (direction === 'R') {
      // Server is ready to receive files (we upload)
      return { type: 'send', offset: idx }
    } else if (direction === 'S') {
      // Server is ready to send files (we download)
      return { type: 'receive', offset: idx }
    }

    return null
  }

  /**
   * Send message to client via websocket
   * @param {Object} msg - Message to send
   */
  sendToClient (msg) {
    if (this.ws && this.ws.s) {
      this.ws.s({
        action: 'trzsz-event',
        ...msg
      })
    }
  }

  /**
   * Handle incoming data from terminal
   * @param {Buffer} data - Incoming data
   * @returns {boolean} - True if data was consumed by trzsz
   */
  handleData (data) {
    // If waiting for save path, buffer the data
    if (this.state === TRZSZ_STATE.WAITING_SAVE_PATH) {
      this.pendingData.push(data)
      return true
    }

    // If we have a pending completion message, check for "Success" from server
    if (this._pendingComplete) {
      const str = Buffer.isBuffer(data) ? data.toString('binary') : data
      if (str.trim() === 'Success' || str.includes('Success')) {
        // Send the session-complete event now
        this.sendToClient(this._pendingComplete)
        this._pendingComplete = null
        return true // Consume the "Success" message
      }
    }

    // If already in a session, feed data to transfer
    if (this.state === TRZSZ_STATE.RECEIVING || this.state === TRZSZ_STATE.SENDING) {
      this.feedData(data)
      return true
    }

    // Check for trzsz start sequence
    const detected = this.detectTrzszStart(data)
    if (detected) {
      if (detected.type === 'receive') {
        this.startReceiver()
        // Feed the data (may contain protocol messages after magic key)
        this.feedData(data)
      } else if (detected.type === 'send') {
        // For upload: create transfer and start process
        // The data contains #CFG: from server which needs to be processed
        this.createTransfer()
        this.state = TRZSZ_STATE.SENDING
        // Feed data first (contains #CFG:)
        this.feedData(data)
        // Then start the upload process
        this.startUploadProcess()
      }
      return true
    }

    return false
  }

  /**
   * Start upload process - send ACT, wait for files, then send
   */
  async startUploadProcess () {
    try {
      // Send action to server (confirm=true means we want to upload)
      await this.transfer.sendAction(true, false)

      // Notify client to select files to send
      this.sendToClient({
        event: 'send-start',
        message: 'TRZSZ send session started, please select files'
      })

      // Wait for config from server (should already be in buffer from feedData)
      await this.transfer.recvConfig()

      // Wait for files to be selected (polling)
      while (this.pendingFiles.length === 0 && this.state === TRZSZ_STATE.SENDING) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (this.state !== TRZSZ_STATE.SENDING) return

      // Open files
      this.fileReaders = this.pendingFiles.map(file => {
        // File can be either a string path or an object with path property
        const filePath = typeof file === 'string' ? file : file.path
        const fileName = path.basename(filePath)
        const reader = new FileReader(filePath, fileName)
        reader.open()
        return reader
      })

      // Send files
      const progressCallback = {
        onNum: (num) => {
          this.sendToClient({
            event: 'file-count',
            count: num
          })
        },
        onName: (name) => {
          this.currentTransfer = {
            name,
            size: 0
          }
          this.startTime = Date.now()
          this.sendToClient({
            event: 'file-start',
            name,
            size: 0
          })
        },
        onSize: (size) => {
          if (this.currentTransfer) {
            this.currentTransfer.size = size
          }
          this.transferSize = size
          this.sendToClient({
            event: 'file-size',
            name: this.currentTransfer?.name,
            size
          })
        },
        onStep: (step) => {
          this.transferredBytes = step
          const now = Date.now()
          if (now - this.lastProgressUpdate > 500) {
            this.lastProgressUpdate = now
            this.sendProgress()
          }
        },
        onDone: () => {
          this.sendToClient({
            event: 'file-complete',
            name: this.currentTransfer?.name,
            path: this.uploadPath
          })
        }
      }

      const remoteNames = await this.transfer.sendFiles(this.fileReaders, progressCallback)

      // Store completion message to send after "Success" from server
      this._pendingComplete = {
        event: 'session-complete',
        message: 'Upload complete',
        files: remoteNames
      }

      // Send EXIT message to server (server will respond with "Success")
      await this.transfer.clientExit('Success')

      // Close all file readers
      for (const reader of this.fileReaders) {
        reader.closeFile()
      }

      this.endSession()
    } catch (err) {
      log.error('Trzsz upload error:', err)
      this.sendToClient({
        event: 'session-error',
        error: err.message
      })
      this.endSession()
    }
  }

  /**
   * Feed data to the transfer
   * @param {Buffer} data - Data to feed
   */
  feedData (data) {
    if (this.transfer) {
      this.transfer.addReceivedData(data)
    }
  }

  /**
   * Create and initialize a TrzszTransfer instance
   */
  createTransfer () {
    this.transfer = new TrzszTransfer((data) => {
      this.writeToTerminal(Buffer.from(data))
    }, false)
    return this.transfer
  }

  /**
   * Start a receive session (remote is sending file(s))
   */
  startReceiver () {
    try {
      this.createTransfer()
      this.state = TRZSZ_STATE.WAITING_SAVE_PATH

      // Notify client to ask for save path
      this.sendToClient({
        event: 'receive-start',
        message: 'TRZSZ receive session started'
      })
    } catch (e) {
      log.error('Failed to start trzsz receiver', e)
      this.endSession()
    }
  }

  /**
   * Process pending data after save path is set
   */
  async processPendingData () {
    if (this.state !== TRZSZ_STATE.WAITING_SAVE_PATH) return

    this.state = TRZSZ_STATE.RECEIVING

    // Start the download process
    try {
      // Send action to server
      await this.transfer.sendAction(true, false)

      // Wait for config from server
      await this.transfer.recvConfig()

      // Receive files
      const downloadDir = this.savePath
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true })
      }

      const openSaveFile = async (saveParam, fileName, directory, overwrite) => {
        const filePath = this.getUniqueFilePath(downloadDir, fileName)
        const writer = new FileWriter(filePath, fileName)
        this.fileWriters.push(writer)

        if (this.currentTransfer) {
          this.sendToClient({
            event: 'file-complete',
            name: this.currentTransfer.name,
            path: this.downloadPath
          })
        }

        this.currentTransfer = {
          name: fileName,
          size: 0
        }
        this.downloadPath = filePath
        this.transferredBytes = 0
        this.startTime = Date.now()

        this.sendToClient({
          event: 'file-start',
          name: fileName,
          size: 0
        })

        return writer
      }

      const progressCallback = {
        onNum: (num) => {
          this.sendToClient({
            event: 'file-count',
            count: num
          })
        },
        onName: (name) => {
          this.currentTransfer = {
            name,
            size: 0
          }
          this.sendToClient({
            event: 'file-start',
            name,
            size: 0
          })
        },
        onSize: (size) => {
          if (this.currentTransfer) {
            this.currentTransfer.size = size
          }
          this.transferSize = size
          this.sendToClient({
            event: 'file-size',
            name: this.currentTransfer?.name,
            size
          })
        },
        onStep: (step) => {
          this.transferredBytes = step
          const now = Date.now()
          if (now - this.lastProgressUpdate > 500) {
            this.lastProgressUpdate = now
            this.sendProgress()
          }
        },
        onDone: () => {
          this.sendToClient({
            event: 'file-complete',
            name: this.currentTransfer?.name,
            path: this.downloadPath
          })
        }
      }

      // Feed pending data first
      for (const data of this.pendingData) {
        this.transfer.addReceivedData(data)
      }
      this.pendingData = []

      const savedFiles = await this.transfer.recvFiles(
        downloadDir,
        openSaveFile,
        progressCallback
      )

      // Map saved files to full paths
      const savedFilePaths = savedFiles.map(name => path.join(downloadDir, name))

      // Close all file writers
      for (const writer of this.fileWriters) {
        writer.closeFile()
      }

      // Store completion message to send after "Success" from server
      this._pendingComplete = {
        event: 'session-complete',
        message: 'Download complete',
        files: savedFilePaths,
        savePath: downloadDir
      }

      // End session first to stop processing incoming data
      this.state = TRZSZ_STATE.IDLE

      // Send EXIT message to server (server will respond with "Success")
      await this.transfer.clientExit('Success')

      // Cleanup
      if (this.transfer) {
        this.transfer.cleanup()
      }
      this.transfer = null
      this.currentTransfer = null
      this.downloadPath = null
      this.pendingFiles = []
      this.fileReaders = []
      this.fileWriters = []
      this.pendingData = []
    } catch (err) {
      log.error('Trzsz download error:', err)
      this.sendToClient({
        event: 'session-error',
        error: err.message
      })
      this.endSession()
    }
  }

  /**
   * Get unique file path if file already exists
   * @param {string} dir - Directory path
   * @param {string} fileName - File name
   * @returns {string} - Unique file path
   */
  getUniqueFilePath (dir, fileName) {
    let filePath = path.join(dir, fileName)

    if (!fs.existsSync(filePath)) {
      return filePath
    }

    const ext = path.extname(fileName)
    const baseName = path.basename(fileName, ext)
    let counter = 1

    while (fs.existsSync(filePath)) {
      const newFileName = `${baseName}.${counter}${ext}`
      filePath = path.join(dir, newFileName)
      counter++
    }

    return filePath
  }

  /**
   * Send progress update to client
   */
  sendProgress () {
    const elapsed = (Date.now() - this.startTime) / 1000
    const speed = elapsed > 0 ? Math.round(this.transferredBytes / elapsed) : 0
    const percent = this.transferSize > 0
      ? Math.floor(this.transferredBytes * 100 / this.transferSize)
      : 100

    this.sendToClient({
      event: 'progress',
      name: this.currentTransfer?.name,
      size: this.transferSize,
      transferred: this.transferredBytes,
      percent,
      speed,
      type: this.state === TRZSZ_STATE.RECEIVING ? 'download' : 'upload',
      path: this.state === TRZSZ_STATE.RECEIVING ? this.downloadPath : this.uploadPath
    })
  }

  /**
   * Set save path for receiving files
   * @param {string} savePath - Directory path to save files
   */
  setSavePath (savePath) {
    this.savePath = savePath
    this.processPendingData()
  }

  /**
   * Set files to send
   * @param {Array} files - Array of file paths
   */
  setSendFiles (files) {
    this.pendingFiles = files
    // processUpload is already running and waiting for files
  }

  /**
   * Write data to terminal
   * @param {Buffer} data - Data to write
   */
  writeToTerminal (data) {
    if (this.term && this.term.write) {
      this.term.write(data)
    }
  }

  /**
   * End trzsz session
   */
  endSession () {
    // Close any open file writers
    for (const writer of this.fileWriters) {
      try {
        writer.closeFile()
      } catch (e) {
        log.error('Error closing file writer', e)
      }
    }

    // Close any open file readers
    for (const reader of this.fileReaders) {
      try {
        reader.closeFile()
      } catch (e) {
        log.error('Error closing file reader', e)
      }
    }

    // Cleanup transfer
    if (this.transfer) {
      try {
        this.transfer.cleanup()
      } catch (e) {
        log.error('Error cleaning up transfer', e)
      }
    }

    // Notify client
    this.sendToClient({
      event: 'session-end'
    })

    // Reset state
    this.state = TRZSZ_STATE.IDLE
    this.transfer = null
    this.currentTransfer = null
    this.downloadPath = null
    this.uploadPath = null
    this.pendingFiles = []
    this.fileReaders = []
    this.fileWriters = []
    this.pendingData = []
    this.savePath = null
  }

  /**
   * Cancel ongoing transfer
   */
  async cancel () {
    if (this.transfer) {
      try {
        await this.transfer.stopTransferring()
      } catch (e) {
        log.error('Error stopping transfer', e)
      }
    }
    this.endSession()
  }

  /**
   * Check if session is active
   * @returns {boolean}
   */
  isActive () {
    return this.state !== TRZSZ_STATE.IDLE
  }

  /**
   * Clean up resources
   */
  destroy () {
    this.endSession()
    this.term = null
    this.ws = null
  }
}

/**
 * TrzszManager manages trzsz sessions for multiple terminals
 */
class TrzszManager {
  constructor () {
    this.sessions = new Map()
  }

  /**
   * Create or get trzsz session for a terminal
   * @param {string} pid - Terminal PID
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   * @returns {TrzszSession}
   */
  getSession (pid, term, ws) {
    if (!this.sessions.has(pid)) {
      const session = new TrzszSession(term, ws)
      this.sessions.set(pid, session)
    }
    return this.sessions.get(pid)
  }

  /**
   * Handle data for a terminal
   * @param {string} pid - Terminal PID
   * @param {Buffer} data - Incoming data
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   * @returns {boolean} - True if data was consumed by trzsz
   */
  handleData (pid, data, term, ws) {
    const session = this.getSession(pid, term, ws)
    return session.handleData(data)
  }

  /**
   * Handle client message
   * @param {string} pid - Terminal PID
   * @param {Object} msg - Message from client
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   */
  handleMessage (pid, msg, term, ws) {
    const session = this.getSession(pid, term, ws)

    switch (msg.event) {
      case 'set-save-path':
        session.setSavePath(msg.path)
        break
      case 'send-files':
        session.setSendFiles(msg.files)
        break
      case 'cancel':
        session.cancel()
        break
    }
  }

  /**
   * Destroy session for a terminal
   * @param {string} pid - Terminal PID
   */
  destroySession (pid) {
    const session = this.sessions.get(pid)
    if (session) {
      session.destroy()
      this.sessions.delete(pid)
    }
  }

  /**
   * Check if terminal has active trzsz session
   * @param {string} pid - Terminal PID
   * @returns {boolean}
   */
  isActive (pid) {
    const session = this.sessions.get(pid)
    return session ? session.isActive() : false
  }
}

// Export singleton manager
const trzszManager = new TrzszManager()

module.exports = {
  TrzszSession,
  TrzszManager,
  trzszManager,
  TRZSZ_STATE,
  TRZSZ_MAGIC_KEY_PREFIX,
  detectTrzszStart: (data) => {
    let str = data
    if (Buffer.isBuffer(data)) {
      str = data.toString('binary')
    }

    const idx = str.lastIndexOf(TRZSZ_MAGIC_KEY_PREFIX)
    if (idx < 0) return false

    const buffer = str.substring(idx)
    const found = buffer.match(TRZSZ_MAGIC_KEY_REGEXP)
    return !!found
  }
}
