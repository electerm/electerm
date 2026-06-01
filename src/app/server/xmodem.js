/**
 * XMODEM protocol handler for serial port file transfers
 * Supports XMODEM-CRC (128-byte) and XMODEM-1K (1024-byte) modes
 */

const fs = require('fs')
const path = require('path')
const log = require('../common/log')
const generate = require('../common/uid')
const sanitizeFilename = require('../common/sanitize-filename')

// XMODEM control characters
const SOH = 0x01 // Start of 128-byte block
const STX = 0x02 // Start of 1024-byte block
const EOT = 0x04 // End of transmission
const ACK = 0x06 // Acknowledge
const NAK = 0x15 // Negative acknowledge
const CAN = 0x18 // Cancel
const CRC = 0x43 // 'C' - request CRC mode

// Packet sizes
const PACKET_SIZE_128 = 128
const PACKET_SIZE_1K = 1024
// Header: SOH/STX(1) + blockNum(1) + ~blockNum(1)
const HEADER_SIZE = 3
// Trailer: CRC-16(2) or checksum(1)
const CRC_TRAILER_SIZE = 2
const CHECKSUM_TRAILER_SIZE = 1

// Protocol constants
const MAX_RETRIES = 10
const RECEIVE_TIMEOUT_MS = 10000 // 10s timeout waiting for packet
const SEND_ACK_TIMEOUT_MS = 10000 // 10s timeout waiting for ACK
const PROGRESS_INTERVAL_MS = 500

// XMODEM session states
const XMODEM_STATE = {
  IDLE: 'idle',
  WAITING_REMOTE: 'waiting_remote', // Waiting for remote to start protocol
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path',
  WAITING_FILES: 'waiting_files'
}

/**
 * CRC-16/XMODEM calculation
 * @param {Buffer} data
 * @returns {number} CRC-16 value
 */
function crc16Xmodem (data) {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc = crc ^ (data[i] << 8)
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc = crc & 0xFFFF
  }
  return crc
}

/**
 * XmodemSession handles XMODEM file transfers for a terminal session
 */
class XmodemSession {
  constructor (term, ws) {
    this.term = term
    this.ws = ws
    this.state = XMODEM_STATE.IDLE
    this.useCrc = true // Prefer CRC mode
    this.use1K = false // 1K packets

    // Receive state
    this.downloadStream = null
    this.downloadPath = null
    this.savePath = null
    this.receiveFileName = null
    this.expectedBlock = 1
    this.receiveBuffer = Buffer.alloc(0)
    this.receiveTimeout = null
    this.retries = 0

    // Send state
    this.uploadPath = null
    this.uploadFd = null
    this.sendBlock = 1
    this.sendSize = 0
    this.sentBytes = 0
    this.currentTransfer = null
    this.transferSize = 0
    this.transferredBytes = 0
    this.startTime = 0
    this.sendTimeout = null
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.pendingSendData = []

    // Progress
    this.lastProgressUpdate = 0
  }

  /**
   * Send message to client via websocket
   */
  sendToClient (msg) {
    if (this.ws && this.ws.s) {
      this.ws.s({
        action: 'xmodem-event',
        ...msg
      })
    }
  }

  /**
   * Write data to the serial port / terminal.
   * Uses writeRaw (if available) to bypass txLineEnding transformation,
   * which would corrupt binary XMODEM protocol bytes (e.g. block# 0x0D = '\r').
   */
  writeToTerminal (data) {
    if (!this.term) return
    if (this.term.writeRaw) {
      this.term.writeRaw(data)
    } else if (this.term.write) {
      this.term.write(data)
    }
  }

  /**
   * Start XMODEM receive - waits for remote to send SOH/STX packets
   */
  startReceive () {
    this.state = XMODEM_STATE.WAITING_REMOTE
    this.expectedBlock = 1
    this.receiveBuffer = Buffer.alloc(0)
    this.retries = 0
    this.useCrc = true
    this.use1K = false

    this.sendToClient({
      event: 'receive-start',
      message: 'XMODEM receive started. Waiting for remote to send file...'
    })

    // Start timeout - if remote doesn't start sending within timeout, cancel
    this.resetReceiveTimeout()
  }

  /**
   * Start XMODEM send - waits for remote to send NAK or 'C'
   */
  startSend () {
    this.state = XMODEM_STATE.WAITING_REMOTE
    this.sendBlock = 1
    this.sentBytes = 0
    this.retries = 0

    this.sendToClient({
      event: 'send-start',
      message: 'XMODEM send started. Waiting for remote to request file...'
    })

    // Start timeout
    this.resetReceiveTimeout()
  }

  /**
   * Handle incoming data from terminal
   * @param {Buffer} data
   * @returns {boolean} true if data was consumed by XMODEM
   */
  handleData (data) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }

    // Waiting for save path - buffer data
    if (this.state === XMODEM_STATE.WAITING_SAVE_PATH) {
      this.receiveBuffer = Buffer.concat([this.receiveBuffer, data])
      return true
    }

    // Waiting for files to be selected
    if (this.state === XMODEM_STATE.WAITING_FILES) {
      this.pendingSendData.push(data)
      return true
    }

    // Actively receiving file data
    if (this.state === XMODEM_STATE.RECEIVING) {
      this.handleReceiveData(data)
      return true
    }

    // Actively sending - look for ACK/NAK/CAN
    if (this.state === XMODEM_STATE.SENDING) {
      this.handleSendResponse(data)
      return true
    }

    // Waiting for remote to start protocol
    if (this.state === XMODEM_STATE.WAITING_REMOTE) {
      if (this.pendingFiles.length > 0) {
        // Send mode: look for NAK or 'C' from remote
        return this.handleSendWaitData(data)
      } else {
        // Receive mode: look for SOH/STX from remote
        return this.handleReceiveWaitData(data)
      }
    }

    return false
  }

  /**
   * Handle data while waiting for remote to start sending (receive mode)
   */
  handleReceiveWaitData (data) {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i]
      if (byte === SOH || byte === STX) {
        // Remote started sending a packet
        this.clearReceiveTimeout()
        this.state = XMODEM_STATE.RECEIVING
        this.receiveBuffer = Buffer.alloc(0)
        this.handleReceiveData(data.subarray(i))
        return true
      }
    }
    // No SOH/STX found yet - still waiting
    return true
  }

  /**
   * Handle data while waiting for remote to request file (send mode)
   */
  handleSendWaitData (data) {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i]
      if (byte === NAK) {
        // Remote requests checksum mode
        this.clearReceiveTimeout()
        this.useCrc = false
        this.retries = 0
        this.sendNextPacket()
        return true
      } else if (byte === CRC) {
        // Remote requests CRC mode
        this.clearReceiveTimeout()
        this.useCrc = true
        this.retries = 0
        this.sendNextPacket()
        return true
      }
    }
    return true
  }

  /**
   * Handle data during active receive
   */
  handleReceiveData (data) {
    this.clearReceiveTimeout()
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data])

    // Try to parse a complete packet
    while (this.receiveBuffer.length > 0) {
      const firstByte = this.receiveBuffer[0]

      if (firstByte === EOT) {
        // End of transmission
        this.receiveBuffer = this.receiveBuffer.subarray(1)
        this.handleReceiveComplete()
        return
      }

      if (firstByte === CAN) {
        // Remote cancelled
        this.sendToClient({
          event: 'session-error',
          error: 'Remote cancelled transfer'
        })
        this.endSession()
        return
      }

      if (firstByte !== SOH && firstByte !== STX) {
        // Skip non-protocol bytes
        this.receiveBuffer = this.receiveBuffer.subarray(1)
        continue
      }

      const packetSize = firstByte === SOH ? PACKET_SIZE_128 : PACKET_SIZE_1K
      const totalPacketSize = HEADER_SIZE + packetSize + (this.useCrc ? CRC_TRAILER_SIZE : CHECKSUM_TRAILER_SIZE)

      if (this.receiveBuffer.length < totalPacketSize) {
        // Not enough data yet, wait for more
        break
      }

      const packet = this.receiveBuffer.subarray(0, totalPacketSize)
      this.receiveBuffer = this.receiveBuffer.subarray(totalPacketSize)

      this.processReceivedPacket(firstByte, packet)
    }

    // Reset timeout for next packet
    this.resetReceiveTimeout()
  }

  /**
   * Process a received XMODEM packet
   */
  processReceivedPacket (headerByte, packet) {
    const blockNum = packet[1]
    const blockNumInv = packet[2]
    const dataStart = HEADER_SIZE
    const dataEnd = dataStart + (headerByte === SOH ? PACKET_SIZE_128 : PACKET_SIZE_1K)
    const data = packet.subarray(dataStart, dataEnd)

    // Validate block number complement
    if ((blockNum ^ blockNumInv) !== 0xFF) {
      log.warn('XMODEM: block number complement mismatch')
      this.sendNak()
      return
    }

    // Validate CRC or checksum
    if (this.useCrc) {
      const receivedCrc = (packet[dataEnd] << 8) | packet[dataEnd + 1]
      const calculatedCrc = crc16Xmodem(data)
      if (receivedCrc !== calculatedCrc) {
        log.warn('XMODEM: CRC mismatch')
        this.sendNak()
        return
      }
    } else {
      let checksum = 0
      for (let i = 0; i < data.length; i++) {
        checksum = (checksum + data[i]) & 0xFF
      }
      if (checksum !== packet[dataEnd]) {
        log.warn('XMODEM: checksum mismatch')
        this.sendNak()
        return
      }
    }

    // Validate block sequence
    if (blockNum !== (this.expectedBlock & 0xFF)) {
      // Could be a retransmit of the previous block
      if (blockNum === ((this.expectedBlock - 1) & 0xFF)) {
        // Retransmit - just ACK it
        this.sendAck()
        return
      }
      log.warn(`XMODEM: expected block ${this.expectedBlock & 0xFF}, got ${blockNum}`)
      this.sendCan()
      this.endSession()
      return
    }

    // Valid packet - write data
    if (!this.downloadStream) {
      this.prepareReceiveFile()
    }

    if (this.downloadStream) {
      this.downloadStream.write(data)
      this.transferredBytes += data.length
      this.sendProgress()
    }

    this.expectedBlock++
    this.retries = 0
    this.sendAck()
  }

  /**
   * Prepare to receive file
   */
  prepareReceiveFile () {
    if (!this.savePath) return

    // Use original filename if provided, otherwise generate one
    const fileName = this.receiveFileName || `xmodem_${Date.now()}.bin`
    let filePath = path.join(this.savePath, sanitizeFilename(fileName))

    if (fs.existsSync(filePath)) {
      filePath = filePath + '.' + generate()
    }

    this.downloadPath = filePath
    this.downloadStream = fs.createWriteStream(filePath, {
      highWaterMark: 64 * 1024
    })
    this.transferredBytes = 0
    this.startTime = Date.now()

    this.sendToClient({
      event: 'file-start',
      name: fileName,
      size: 0 // XMODEM doesn't know size upfront
    })
  }

  /**
   * Handle receive complete (EOT received)
   */
  handleReceiveComplete () {
    // Send ACK for EOT
    this.writeToTerminal(Buffer.from([ACK]))

    if (this.downloadStream) {
      this.downloadStream.end()
      this.downloadStream = null
    }

    this.sendProgress()

    this.sendToClient({
      event: 'file-complete',
      name: path.basename(this.downloadPath || ''),
      path: this.downloadPath
    })

    this.sendToClient({
      event: 'session-end'
    })

    this.resetState()
  }

  /**
   * Send ACK to remote
   */
  sendAck () {
    this.writeToTerminal(Buffer.from([ACK]))
  }

  /**
   * Send NAK to remote
   */
  sendNak () {
    this.retries++
    if (this.retries > MAX_RETRIES) {
      log.error('XMODEM: max retries exceeded')
      this.sendCan()
      this.endSession()
      return
    }
    this.writeToTerminal(Buffer.from([NAK]))
    this.resetReceiveTimeout()
  }

  /**
   * Send CAN (cancel) to remote
   */
  sendCan () {
    this.writeToTerminal(Buffer.from([CAN, CAN, CAN, CAN, CAN]))
  }

  /**
   * Reset receive timeout
   */
  resetReceiveTimeout () {
    this.clearReceiveTimeout()
    this.receiveTimeout = setTimeout(() => {
      if (this.state === XMODEM_STATE.RECEIVING) {
        this.sendNak()
      } else if (this.state === XMODEM_STATE.WAITING_REMOTE) {
        this.retries++
        if (this.retries > MAX_RETRIES) {
          this.sendToClient({
            event: 'session-error',
            error: 'Timeout waiting for remote'
          })
          this.endSession()
          return
        }
        // In receive mode, send NAK to prompt remote to start
        // In send mode, do nothing - remote must initiate
        if (this.pendingFiles.length === 0) {
          this.writeToTerminal(Buffer.from([NAK]))
        }
        this.resetReceiveTimeout()
      }
    }, RECEIVE_TIMEOUT_MS)
  }

  /**
   * Clear receive timeout
   */
  clearReceiveTimeout () {
    if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout)
      this.receiveTimeout = null
    }
  }

  /**
   * Set save path for receiving files
   */
  setSavePath (savePath, name) {
    this.savePath = savePath
    this.receiveFileName = name || null
    // Process buffered data
    if (this.receiveBuffer.length > 0) {
      const buffered = this.receiveBuffer
      this.receiveBuffer = Buffer.alloc(0)
      this.state = XMODEM_STATE.RECEIVING
      this.handleReceiveData(buffered)
    } else {
      this.state = XMODEM_STATE.WAITING_REMOTE
      this.resetReceiveTimeout()
    }
  }

  /**
   * Set files to send
   */
  setSendFiles (files) {
    this.pendingFiles = files
    this.currentFileIndex = 0

    // Process any buffered data (may contain NAK/C from remote)
    if (this.pendingSendData.length > 0) {
      for (const data of this.pendingSendData) {
        this.handleSendWaitData(data)
      }
      this.pendingSendData = []
    }

    // If we already detected NAK/C and are ready to send, start
    if (files.length > 0 && this.state === XMODEM_STATE.WAITING_REMOTE) {
      // Remote hasn't sent NAK/C yet, keep waiting
      this.resetReceiveTimeout()
    }
  }

  /**
   * Send next packet to remote
   */
  sendNextPacket () {
    if (this.currentFileIndex >= this.pendingFiles.length) {
      // All files sent
      this.sendEot()
      return
    }

    const file = this.pendingFiles[this.currentFileIndex]

    // Open file if not already open
    if (!this.uploadFd) {
      try {
        this.uploadFd = fs.openSync(file.path, 'r')
        this.sendSize = file.size
        this.sentBytes = 0
        this.sendBlock = 1

        this.currentTransfer = {
          name: file.name,
          size: file.size
        }
        this.transferSize = file.size
        this.transferredBytes = 0
        this.startTime = Date.now()

        this.sendToClient({
          event: 'file-start',
          name: file.name,
          size: file.size
        })
      } catch (e) {
        log.error('XMODEM: failed to open file', e)
        this.sendCan()
        this.endSession()
        return
      }
    }

    // Read next chunk
    const packetSize = this.use1K ? PACKET_SIZE_1K : PACKET_SIZE_128
    const remaining = this.sendSize - this.sentBytes

    if (remaining <= 0) {
      // File done, send EOT
      fs.closeSync(this.uploadFd)
      this.uploadFd = null
      this.sendEot()
      return
    }

    const readSize = Math.min(packetSize, remaining)
    const buf = Buffer.alloc(packetSize) // Pad with 0x1A (SUB) if needed
    buf.fill(0x1A) // XMODEM pads with SUB (0x1A)

    try {
      fs.readSync(this.uploadFd, buf, 0, readSize, this.sentBytes)
    } catch (e) {
      log.error('XMODEM: failed to read file', e)
      this.sendCan()
      this.endSession()
      return
    }

    // Build packet
    const headerByte = this.use1K ? STX : SOH
    const blockNum = this.sendBlock & 0xFF
    const packet = Buffer.alloc(HEADER_SIZE + packetSize + (this.useCrc ? CRC_TRAILER_SIZE : CHECKSUM_TRAILER_SIZE))

    packet[0] = headerByte
    packet[1] = blockNum
    packet[2] = blockNum ^ 0xFF
    buf.copy(packet, HEADER_SIZE, 0, packetSize)

    if (this.useCrc) {
      const crc = crc16Xmodem(buf.subarray(0, packetSize))
      packet[HEADER_SIZE + packetSize] = (crc >> 8) & 0xFF
      packet[HEADER_SIZE + packetSize + 1] = crc & 0xFF
    } else {
      let checksum = 0
      for (let i = 0; i < packetSize; i++) {
        checksum = (checksum + buf[i]) & 0xFF
      }
      packet[HEADER_SIZE + packetSize] = checksum
    }

    this.writeToTerminal(packet)
    this.state = XMODEM_STATE.SENDING
    this.sentBytes += readSize
    this.transferredBytes = this.sentBytes

    // Progress update
    const now = Date.now()
    if (!this.lastProgressUpdate || now - this.lastProgressUpdate > PROGRESS_INTERVAL_MS) {
      this.lastProgressUpdate = now
      this.sendProgress()
    }

    // Timeout waiting for ACK
    this.resetSendTimeout()
  }

  /**
   * Handle response during send (ACK/NAK/CAN)
   */
  handleSendResponse (data) {
    this.clearSendTimeout()

    for (let i = 0; i < data.length; i++) {
      const byte = data[i]

      if (byte === ACK) {
        // Block acknowledged
        this.sendBlock++
        this.retries = 0
        this.sendNextPacket()
        return
      } else if (byte === NAK) {
        // Retransmit current block
        this.retries++
        if (this.retries > MAX_RETRIES) {
          log.error('XMODEM: max retries exceeded during send')
          this.sendCan()
          this.endSession()
          return
        }
        // Re-read and resend the same block (keep sendBlock unchanged – same block#)
        this.sentBytes -= (this.use1K ? PACKET_SIZE_1K : PACKET_SIZE_128)
        if (this.sentBytes < 0) this.sentBytes = 0
        this.sendNextPacket()
        return
      } else if (byte === CAN) {
        // Remote cancelled
        this.sendToClient({
          event: 'session-error',
          error: 'Remote cancelled transfer'
        })
        this.endSession()
        return
      }
    }
  }

  /**
   * Send EOT (end of transmission)
   */
  sendEot () {
    // Guard: if already past SENDING (e.g. called again via ACK→sendNextPacket
    // after we already sent EOT), skip to avoid infinite EOT loop.
    if (this.state !== XMODEM_STATE.SENDING &&
        this.state !== XMODEM_STATE.WAITING_REMOTE) {
      return
    }

    this.writeToTerminal(Buffer.from([EOT]))

    // Wait for ACK of EOT
    this.resetSendTimeout()

    // Send final progress
    if (this.currentTransfer) {
      this.transferredBytes = this.transferSize
      this.sendProgress()
    }

    this.sendToClient({
      event: 'file-complete',
      name: this.currentTransfer?.name,
      path: this.uploadPath
    })

    this.sendToClient({
      event: 'session-end'
    })

    // Reset state so isActive() returns false and normal terminal I/O resumes.
    // This mirrors handleReceiveComplete() which also calls resetState() after
    // sending session-end.
    this.resetState()
  }

  /**
   * Reset send timeout
   */
  resetSendTimeout () {
    this.clearSendTimeout()
    this.sendTimeout = setTimeout(() => {
      if (this.state === XMODEM_STATE.SENDING) {
        this.retries++
        if (this.retries > MAX_RETRIES) {
          this.sendToClient({
            event: 'session-error',
            error: 'Timeout waiting for ACK'
          })
          this.endSession()
          return
        }
        // Resend EOT if we already sent it, otherwise resend packet
        if (this.sentBytes >= this.sendSize) {
          this.writeToTerminal(Buffer.from([EOT]))
        } else {
          // Resend current block (keep sendBlock unchanged – same block# must be retransmitted)
          this.sentBytes -= (this.use1K ? PACKET_SIZE_1K : PACKET_SIZE_128)
          if (this.sentBytes < 0) this.sentBytes = 0
          this.sendNextPacket()
        }
        this.resetSendTimeout()
      }
    }, SEND_ACK_TIMEOUT_MS)
  }

  /**
   * Clear send timeout
   */
  clearSendTimeout () {
    if (this.sendTimeout) {
      clearTimeout(this.sendTimeout)
      this.sendTimeout = null
    }
  }

  /**
   * Send progress update to client
   */
  sendProgress () {
    const elapsed = (Date.now() - this.startTime) / 1000
    const speed = elapsed > 0 ? Math.round(this.transferredBytes / elapsed) : 0
    const percent = this.transferSize > 0
      ? Math.floor(this.transferredBytes * 100 / this.transferSize)
      : 0

    this.sendToClient({
      event: 'progress',
      name: this.currentTransfer?.name,
      size: this.transferSize,
      transferred: this.transferredBytes,
      percent,
      speed,
      type: this.state === XMODEM_STATE.RECEIVING ? 'download' : 'upload',
      path: this.state === XMODEM_STATE.RECEIVING ? this.downloadPath : this.uploadPath
    })
  }

  /**
   * Cancel transfer
   */
  cancel () {
    this.sendCan()
    this.endSession()
  }

  /**
   * End session and reset state
   */
  endSession () {
    this.clearReceiveTimeout()
    this.clearSendTimeout()

    if (this.downloadStream) {
      try { this.downloadStream.end() } catch (e) { log.error('Error closing download stream', e) }
      this.downloadStream = null
    }

    if (this.uploadFd) {
      try { fs.closeSync(this.uploadFd) } catch (e) { log.error('Error closing upload file', e) }
      this.uploadFd = null
    }

    if (this.currentTransfer) {
      this.transferredBytes = this.transferSize
      this.sendProgress()
    }

    this.sendToClient({ event: 'session-end' })
    this.resetState()
  }

  /**
   * Reset session state
   */
  resetState () {
    this.clearReceiveTimeout()
    this.clearSendTimeout()
    this.state = XMODEM_STATE.IDLE
    this.downloadStream = null
    this.downloadPath = null
    this.savePath = null
    this.receiveFileName = null
    this.expectedBlock = 1
    this.receiveBuffer = Buffer.alloc(0)
    this.retries = 0
    this.uploadPath = null
    this.uploadFd = null
    this.sendBlock = 1
    this.sendSize = 0
    this.sentBytes = 0
    this.currentTransfer = null
    this.transferSize = 0
    this.transferredBytes = 0
    this.startTime = 0
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.pendingSendData = []
    this.lastProgressUpdate = 0
  }

  /**
   * Check if session is active
   */
  isActive () {
    return this.state !== XMODEM_STATE.IDLE
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
 * XmodemManager manages XMODEM sessions for multiple terminals
 */
class XmodemManager {
  constructor () {
    this.sessions = new Map()
  }

  getSession (pid, term, ws) {
    if (!this.sessions.has(pid)) {
      this.sessions.set(pid, new XmodemSession(term, ws))
    }
    return this.sessions.get(pid)
  }

  /**
   * Handle data for a terminal
   * @returns {boolean} true if data was consumed
   */
  handleData (pid, data, term, ws) {
    const session = this.getSession(pid, term, ws)
    return session.handleData(data)
  }

  /**
   * Handle client message
   */
  handleMessage (pid, msg, term, ws) {
    const session = this.getSession(pid, term, ws)

    switch (msg.event) {
      case 'set-save-path':
        session.setSavePath(msg.path, msg.name)
        break
      case 'send-files':
        session.setSendFiles(msg.files)
        break
      case 'cancel':
        session.cancel()
        break
      case 'start-receive':
        session.startReceive()
        break
      case 'start-send':
        session.startSend()
        break
    }
  }

  destroySession (pid) {
    const session = this.sessions.get(pid)
    if (session) {
      session.destroy()
      this.sessions.delete(pid)
    }
  }

  isActive (pid) {
    const session = this.sessions.get(pid)
    return session ? session.isActive() : false
  }
}

const xmodemManager = new XmodemManager()

module.exports = {
  XmodemSession,
  XmodemManager,
  xmodemManager,
  XMODEM_STATE
}
