/**
 * Zmodem protocol handler for server-side terminal sessions
 * Uses zmodem2 (pure JS) for protocol implementation
 */

const fs = require('fs')
const path = require('path')
const log = require('../common/log')
const generate = require('../common/uid')

// Import zmodem2 (pure JS, no WASM)
const { Sender, Receiver, SenderEvent, ReceiverEvent } = require('zmodem2/cjs-full')

// Zmodem state constants
const ZMODEM_STATE = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path'
}

// Zmodem header signature: ** + \x18 + B
const ZMODEM_HEADER = Buffer.from([0x2a, 0x2a, 0x18, 0x42])

// ZRQINIT = 00 00 00 00 (receive request)
const ZRQINIT = Buffer.from([0x30, 0x30])
// ZRINIT = 00 01 (send request)
const ZRINIT = Buffer.from([0x30, 0x31])

/**
 * ZmodemSession class handles zmodem file transfers for a terminal session
 */
class ZmodemSession {
  constructor (term, ws) {
    this.term = term
    this.ws = ws
    this.state = ZMODEM_STATE.IDLE
    this.receiver = null
    this.sender = null
    this.currentTransfer = null
    this.downloadStream = null // Write stream for file download
    this.downloadPath = null
    this.uploadStream = null // Read stream for file upload
    this.uploadPath = null
    this.transferSize = 0
    this.transferredBytes = 0
    this.startTime = 0
    this.savePath = null
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.fileBuffer = null // Buffer for file data during upload (used for small chunks)
    this.fileReadPosition = 0 // Track read position for streaming
    this.pendingData = [] // Buffer for incoming data before save path is set
    this.pendingFileInfo = null // Buffer for file info before save path is set
    this.pendingSendData = [] // Buffer for incoming data before files are selected
    // No WASM initialization needed - pure JS
  }

  /**
   * Check if data contains zmodem escape sequence
   * @param {Buffer} data - Data to check
   * @returns {Object|null} - { type: 'receive'|'send', offset: number } or null
   */
  detectZmodemStart (data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }

    // Find zmodem header signature
    for (let i = 0; i < data.length - 5; i++) {
      if (
        data[i] === ZMODEM_HEADER[0] &&
        data[i + 1] === ZMODEM_HEADER[1] &&
        data[i + 2] === ZMODEM_HEADER[2] &&
        data[i + 3] === ZMODEM_HEADER[3]
      ) {
        const typeHex1 = data[i + 4]
        const typeHex2 = data[i + 5]

        if (typeHex1 === ZRQINIT[0] && typeHex2 === ZRQINIT[1]) {
          // ZRQINIT - Remote wants to send file(s), we receive
          return { type: 'receive', offset: i }
        } else if (typeHex1 === ZRINIT[0] && typeHex2 === ZRINIT[1]) {
          // ZRINIT - Remote is ready to receive, we send
          return { type: 'send', offset: i }
        }
      }
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
        action: 'zmodem-event',
        ...msg
      })
    }
  }

  /**
   * Handle incoming data from terminal
   * @param {Buffer} data - Incoming data
   * @returns {boolean} - True if data was consumed by zmodem
   */
  handleData (data) {
    // If waiting for save path, buffer the data
    if (this.state === ZMODEM_STATE.WAITING_SAVE_PATH) {
      this.pendingData.push(data)
      return true
    }

    // If sending but waiting for files, buffer the data
    if (this.state === ZMODEM_STATE.SENDING && this.pendingFiles.length === 0) {
      this.pendingSendData.push(data)
      return true
    }

    // If already in a session, process data
    if (this.state === ZMODEM_STATE.RECEIVING) {
      this.handleReceiverData(data)
      return true
    } else if (this.state === ZMODEM_STATE.SENDING) {
      this.handleSenderData(data)
      return true
    }

    // Check for zmodem start sequence
    const detected = this.detectZmodemStart(data)
    if (detected) {
      if (detected.type === 'receive') {
        this.startReceiver(data.subarray(detected.offset))
      } else if (detected.type === 'send') {
        this.startSender(data.subarray(detected.offset))
      }
      return true
    }

    return false
  }

  /**
   * Start a receive session (remote is sending file(s))
   * @param {Buffer} initialData - Initial zmodem data
   */
  startReceiver (initialData) {
    try {
      this.receiver = new Receiver()
      this.transferredBytes = 0
      // startTime will be set when first data is received

      // Notify client to ask for save path
      this.sendToClient({
        event: 'receive-start',
        message: 'ZMODEM receive session started'
      })

      // Store initial data and wait for save path
      if (initialData) {
        this.pendingData.push(initialData)
      }
      this.state = ZMODEM_STATE.WAITING_SAVE_PATH
    } catch (e) {
      log.error('Failed to start zmodem receiver', e)
      this.endSession()
    }
  }

  /**
   * Process pending data after save path is set
   */
  processPendingData () {
    if (this.state !== ZMODEM_STATE.WAITING_SAVE_PATH) return

    this.state = ZMODEM_STATE.RECEIVING

    // Process all pending data
    for (const data of this.pendingData) {
      this.handleReceiverData(data)
    }
    this.pendingData = []

    // Process pending file info if any
    if (this.pendingFileInfo) {
      this.prepareReceiveFile(this.pendingFileInfo.name, this.pendingFileInfo.size)
      this.pendingFileInfo = null
    }
  }

  /**
   * Handle data during receive session
   * @param {Buffer} data - Incoming data
   */
  handleReceiverData (data) {
    if (!this.receiver) return

    const u8 = Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(data)
    let offset = 0
    let loopCount = 0

    while (offset < u8.length && loopCount++ < 1000) {
      if (!this.receiver) break
      try {
        const chunk = u8.subarray(offset)
        const consumed = this.receiver.feedIncoming(chunk)
        offset += consumed

        const drained = this.pumpReceiver()

        if (consumed === 0 && !drained) {
          break
        }
      } catch (e) {
        log.error('Zmodem receiver error:', e)
        this.endSession()
        break
      }
    }
  }

  /**
   * Pump receiver: drain outgoing data and handle events
   * @returns {boolean} - True if work was done
   */
  pumpReceiver () {
    if (!this.receiver) return false
    let didWork = false

    try {
      // Drain outgoing data and send to terminal
      const outgoing = this.receiver.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
        didWork = true
      }

      // Poll for events
      let event
      while ((event = this.receiver.pollEvent()) !== null) {
        didWork = true

        if (event === ReceiverEvent.FileStart) {
          const name = this.receiver.getFileName()
          const size = this.receiver.getFileSize()
          this.handleFileStart(name, size)
        } else if (event === ReceiverEvent.FileComplete) {
          this.handleFileComplete()
        } else if (event === ReceiverEvent.SessionComplete) {
          this.endSession()
          return true
        }
      }

      // Drain received file data
      const chunk = this.receiver.drainFile()
      if (chunk && chunk.length > 0) {
        this.handleFileData(Buffer.from(chunk))
        this.receiver.advanceFile(chunk.length)
        didWork = true
      }
    } catch (e) {
      log.error('Zmodem receiver pump error:', e)
      this.endSession()
    }
    return didWork
  }

  /**
   * Handle file start event
   * @param {string} name - File name
   * @param {number} size - File size
   */
  handleFileStart (name, size) {
    this.currentTransfer = {
      name,
      size
    }
    this.transferSize = size
    this.transferredBytes = 0
    // startTime will be set when first data is received

    // Prepare file for receiving
    this.prepareReceiveFile(name, size)

    // Notify client about incoming file
    this.sendToClient({
      event: 'file-start',
      name,
      size
    })
  }

  /**
   * Handle file data chunk
   * @param {Buffer} data - File data chunk
   */
  handleFileData (data) {
    if (!this.downloadStream || !this.currentTransfer) return

    try {
      // Set start time on first data received
      if (this.transferredBytes === 0) {
        this.startTime = Date.now()
      }

      // Write to stream (non-blocking)
      if (!this.downloadStream.write(data)) {
        // Stream buffer is full, wait for drain
        // The stream will handle backpressure automatically
      }
      this.transferredBytes += data.length

      // Throttled progress update
      const now = Date.now()
      if (!this.lastProgressUpdate || now - this.lastProgressUpdate > 500) {
        this.lastProgressUpdate = now
        this.sendProgress()
      }
    } catch (e) {
      log.error('Failed to write file data', e)
      this.endSession()
    }
  }

  /**
   * Handle file complete event
   */
  handleFileComplete () {
    // Send final progress update with 100%
    if (this.currentTransfer) {
      this.transferredBytes = this.transferSize
      this.sendProgress()
    }

    if (this.downloadStream) {
      this.downloadStream.end()
      this.downloadStream = null
    }

    this.sendToClient({
      event: 'file-complete',
      name: this.currentTransfer?.name,
      path: this.downloadPath
    })

    this.currentTransfer = null
    this.downloadPath = null
  }

  /**
   * Send progress update to client
   */
  sendProgress () {
    const elapsed = (Date.now() - this.startTime) / 1000 // seconds
    const speed = elapsed > 0 ? Math.round(this.transferredBytes / elapsed) : 0 // bytes per second
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
      type: this.state === ZMODEM_STATE.RECEIVING ? 'download' : 'upload',
      path: this.state === ZMODEM_STATE.RECEIVING ? this.downloadPath : this.uploadPath
    })
  }

  /**
   * Start a send session (remote is ready to receive file(s))
   * @param {Buffer} initialData - Initial zmodem data (contains ZRINIT)
   */
  startSender (initialData) {
    try {
      this.state = ZMODEM_STATE.SENDING
      // Create sender as non-initiator (false) since remote sent ZRINIT first
      this.sender = new Sender(false)

      // Buffer initial data to process after files are selected
      if (initialData && initialData.length > 0) {
        this.pendingSendData = [Buffer.isBuffer(initialData) ? initialData : Buffer.from(initialData)]
      } else {
        this.pendingSendData = []
      }

      // Notify client to select files to send
      this.sendToClient({
        event: 'send-start',
        message: 'ZMODEM send session started, please select files'
      })
    } catch (e) {
      log.error('Failed to start zmodem sender', e)
      this.endSession()
    }
  }

  /**
   * Handle data during send session
   * @param {Buffer} data - Incoming data
   */
  handleSenderData (data) {
    if (!this.sender) return

    const u8 = Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(data)
    let offset = 0
    let loopCount = 0

    // Check for ZSKIP frame (file already exists on remote side)
    // ZSKIP = frame type 5 = "05" in hex = 0x30 0x35 in ASCII hex encoding
    // Format: ** ZDLE B <frame-type-hex> <data> CRC
    const dataHex = Buffer.from(u8).toString('hex')
    if (dataHex.includes('2a2a18423035') || dataHex.includes('2a2a1842' + '3035')) {
      // Handle ZSKIP - skip current file and move to next
      this.handleFileSkipped()
      return
    }

    while (offset < u8.length && loopCount++ < 1000) {
      if (!this.sender) break
      try {
        const chunk = u8.subarray(offset)
        const consumed = this.sender.feedIncoming(chunk)
        offset += consumed

        const drained = this.pumpSender()

        if (consumed === 0 && !drained) {
          break
        }
      } catch (e) {
        log.error('Zmodem sender error:', e)
        this.endSession()
        break
      }
    }
  }

  /**
   * Handle file skipped (ZSKIP received from remote)
   */
  handleFileSkipped () {
    // Notify client
    this.sendToClient({
      event: 'file-skipped',
      name: this.currentTransfer?.name,
      message: 'File already exists on remote side'
    })

    // Clean up current file
    this.currentTransfer = null
    this.fileBuffer = null
    this.transferredBytes = 0

    // Send cancel sequence to terminate the session with the remote
    // Since the sender is in state 2 (sending file), we can't use finishSession()
    // Use cancel sequence instead
    const cancelSequence = Buffer.from([0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x42])
    this.writeToTerminal(cancelSequence)

    // End the session
    this.endSession()
  }

  /**
   * Pump sender: drain outgoing, process events, handle file requests
   * @returns {boolean} - True if work was done
   */
  pumpSender () {
    if (!this.sender) return false
    let didWork = false

    try {
      // Drain and send outgoing data
      const outgoing = this.sender.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
        didWork = true
      }

      // Process events
      let event
      while ((event = this.sender.pollEvent()) !== null) {
        didWork = true

        if (event === SenderEvent.FileComplete) {
          this.handleSendFileComplete()
        } else if (event === SenderEvent.SessionComplete) {
          this.endSession()
          return true
        }
      }

      // Handle file data requests
      const request = this.sender.pollFile()
      if (request !== null) {
        this.sendFileData(request.offset, request.len)
        didWork = true
      }
    } catch (e) {
      log.error('Zmodem sender pump error', e)
      this.endSession()
    }

    return didWork
  }

  /**
   * Send file data to sender using streaming read
   * @param {number} offset - File offset
   * @param {number} length - Data length to read
   */
  sendFileData (offset, length) {
    if (!this.currentTransfer || !this.sender) return

    try {
      // Check if we need to read more data from file
      // Use a buffer pool for streaming reads
      const CHUNK_SIZE = 64 * 1024 // 64KB chunks for streaming
      const data = Buffer.allocUnsafe(Math.min(length, CHUNK_SIZE))

      // Read from current position if using streaming
      if (!this.uploadFd) {
        // Open file descriptor for streaming read
        this.uploadFd = fs.openSync(this.uploadPath, 'r')
        this.fileReadPosition = 0
      }

      // Seek to correct position if needed
      if (offset !== this.fileReadPosition) {
        // For random access, we need to seek
        // But zmodem typically reads sequentially, so this should be rare
      }

      const bytesRead = fs.readSync(this.uploadFd, data, 0, Math.min(length, CHUNK_SIZE), offset)
      const actualData = data.slice(0, bytesRead)
      this.fileReadPosition = offset + bytesRead

      if (actualData.length > 0) {
        // Set start time on first data transfer
        if (this.transferredBytes === 0) {
          this.startTime = Date.now()
        }

        this.sender.feedFile(new Uint8Array(actualData))
        this.transferredBytes = offset + actualData.length

        // Throttled progress update
        const now = Date.now()
        if (!this.lastProgressUpdate || now - this.lastProgressUpdate > 500) {
          this.lastProgressUpdate = now
          this.sendProgress()
        }

        // Drain outgoing after feeding file data
        const outgoing = this.sender.drainOutgoing()
        if (outgoing && outgoing.length > 0) {
          this.writeToTerminal(Buffer.from(outgoing))
        }
      }

      if (bytesRead === 0 || offset + bytesRead >= this.currentTransfer.size) {
        // All data sent, close file and finish session
        if (this.uploadFd) {
          fs.closeSync(this.uploadFd)
          this.uploadFd = null
        }
        this.sender.finishSession()
        const outgoing = this.sender.drainOutgoing()
        if (outgoing && outgoing.length > 0) {
          this.writeToTerminal(Buffer.from(outgoing))
        }
      }
    } catch (e) {
      log.error('Failed to read file data for sending', e)
      this.endSession()
    }
  }

  /**
   * Handle send file complete event
   */
  handleSendFileComplete () {
    // Check if file was skipped (already exists on remote side)
    // This happens when transferredBytes is 0 but we got a FileComplete event
    const wasSkipped = this.transferredBytes === 0 && this.transferSize > 0

    if (wasSkipped) {
      // File was skipped - already exists on remote side
      this.sendToClient({
        event: 'file-skipped',
        name: this.currentTransfer?.name,
        message: 'File already exists on remote side'
      })
    } else {
      // Send final progress update with 100%
      if (this.currentTransfer) {
        this.transferredBytes = this.transferSize
        this.sendProgress()
      }

      this.sendToClient({
        event: 'file-complete',
        name: this.currentTransfer?.name,
        path: this.uploadPath
      })
    }

    // Move to next file if any
    this.currentFileIndex++
    if (this.pendingFiles.length > this.currentFileIndex) {
      this.sendFile(this.pendingFiles[this.currentFileIndex])
    } else {
      // All files sent, finish session
      this.finishSender()
    }
  }

  /**
   * Send a file using streaming (no full file read into memory)
   * @param {Object} file - File info { path, name, size }
   */
  sendFile (file) {
    if (!this.sender) return

    try {
      this.currentTransfer = {
        name: file.name,
        size: file.size
      }
      this.transferSize = file.size
      this.transferredBytes = 0
      this.uploadPath = file.path
      this.fileReadPosition = 0
      this.fileBuffer = null // No longer buffer entire file

      // Close any previous upload file descriptor
      if (this.uploadFd) {
        fs.closeSync(this.uploadFd)
        this.uploadFd = null
      }

      // Start file transfer (startTime will be set when first data is sent)
      // File will be read in chunks in sendFileData()
      this.sender.startFile(file.name, file.size)

      // Drain outgoing after starting file
      const outgoing = this.sender.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
      }

      this.sendToClient({
        event: 'file-start',
        name: file.name,
        size: file.size
      })
    } catch (e) {
      log.error('Failed to send file', e)
      this.endSession()
    }
  }

  /**
   * Finish sender session
   */
  finishSender () {
    if (!this.sender) return

    try {
      this.sender.finishSession()
      const outgoing = this.sender.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
      }
    } catch (e) {
      log.error('Failed to finish sender session', e)
      this.endSession()
    }
  }

  /**
   * Set save path for receiving files
   * @param {string} savePath - Directory path to save files
   */
  setSavePath (savePath) {
    this.savePath = savePath
    // Process pending data now that we have the save path
    this.processPendingData()
  }

  /**
   * Set files to send
   * @param {Array} files - Array of file info objects
   */
  setSendFiles (files) {
    this.pendingFiles = files
    this.currentFileIndex = 0

    // First, process any pending data that was buffered before files were selected
    // This includes the initial ZRINIT which the sender needs to transition to state 1
    if (this.pendingSendData.length > 0) {
      for (const data of this.pendingSendData) {
        this.handleSenderData(data)
      }
      this.pendingSendData = []
    }

    if (files.length > 0) {
      this.sendFile(files[0])
    } else {
      this.finishSender()
    }
  }

  /**
   * Prepare to receive a file using write stream
   * @param {string} name - File name
   * @param {number} size - File size
   */
  prepareReceiveFile (name, size) {
    if (!this.savePath) {
      // Store file info for later
      this.pendingFileInfo = { name, size }
      return
    }

    try {
      let filePath = path.join(this.savePath, name)

      // Check if file exists, add suffix if needed
      if (fs.existsSync(filePath)) {
        filePath = filePath + '.' + generate()
      }

      this.downloadPath = filePath
      // Create write stream for streaming file write
      this.downloadStream = fs.createWriteStream(filePath, {
        highWaterMark: 64 * 1024 // 64KB buffer for better performance
      })
      this.transferSize = size
      this.transferredBytes = 0
      // startTime will be set when first data is received

      this.sendToClient({
        event: 'file-prepared',
        name,
        path: filePath,
        size
      })
    } catch (e) {
      log.error('Failed to prepare receive file', e)
      this.endSession()
    }
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
   * End zmodem session
   */
  endSession () {
    // Close any open file streams
    if (this.downloadStream) {
      try {
        this.downloadStream.end()
      } catch (e) {
        log.error('Error closing download stream', e)
      }
      this.downloadStream = null
    }

    if (this.uploadFd) {
      try {
        fs.closeSync(this.uploadFd)
      } catch (e) {
        log.error('Error closing upload file', e)
      }
      this.uploadFd = null
    }

    // Send final progress
    if (this.currentTransfer) {
      this.transferredBytes = this.transferSize
      this.sendProgress()
    }

    // Notify client
    this.sendToClient({
      event: 'session-end'
    })

    // Reset state
    this.state = ZMODEM_STATE.IDLE
    this.receiver = null
    this.sender = null
    this.currentTransfer = null
    this.downloadPath = null
    this.uploadPath = null
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.savePath = null
    this.fileBuffer = null
    this.fileReadPosition = 0
    this.pendingData = []
    this.pendingFileInfo = null
    this.pendingSendData = []
  }

  /**
   * Cancel ongoing transfer
   * Sends Zmodem cancel sequence (5 CAN characters + ZDLE + 'B') to remote
   */
  cancel () {
    // Send zmodem cancel sequence: 5 CAN (0x18) + ZDLE (0x18) + 'B' (0x42)
    // This tells the remote side to abort the transfer
    const cancelSequence = Buffer.from([0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x42])
    this.writeToTerminal(cancelSequence)
    this.endSession()
  }

  /**
   * Check if session is active
   * @returns {boolean}
   */
  isActive () {
    return this.state !== ZMODEM_STATE.IDLE
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
 * ZmodemManager manages zmodem sessions for multiple terminals
 */
class ZmodemManager {
  constructor () {
    this.sessions = new Map()
  }

  /**
   * Create or get zmodem session for a terminal
   * @param {string} pid - Terminal PID
   * @param {Object} term - Terminal instance
   * @param {Object} ws - WebSocket connection
   * @returns {ZmodemSession}
   */
  getSession (pid, term, ws) {
    if (!this.sessions.has(pid)) {
      const session = new ZmodemSession(term, ws)
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
   * @returns {boolean} - True if data was consumed by zmodem
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
      case 'prepare-receive':
        session.prepareReceiveFile(msg.name, msg.size)
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
   * Check if terminal has active zmodem session
   * @param {string} pid - Terminal PID
   * @returns {boolean}
   */
  isActive (pid) {
    const session = this.sessions.get(pid)
    return session ? session.isActive() : false
  }
}

// Export singleton manager
const zmodemManager = new ZmodemManager()

module.exports = {
  ZmodemSession,
  ZmodemManager,
  zmodemManager,
  ZMODEM_STATE,
  ZMODEM_HEADER
}
