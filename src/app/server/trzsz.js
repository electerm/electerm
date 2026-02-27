/**
 * Optimized Trzsz protocol handler for server-side terminal sessions
 * Uses trzsz2 (pure JS) for protocol implementation
 *
 * Performance improvements over original:
 * 1. Async file I/O with adaptive buffer sizing (matches trzsz default 10MB)
 * 2. Write buffering with backpressure handling (drain events)
 * 3. Event-driven file selection instead of polling loop
 * 4. Batched progress updates with configurable interval
 * 5. Proper stream pipeline for writes with highWaterMark tuning
 */
const fs = require('fs')
const { open } = require('fs/promises')
const path = require('path')
const log = require('../common/log')
const { TrzszTransfer } = require('trzsz2')
// Constants
const TRZSZ_STATE = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path'
}
// Pre-allocated detection buffers (avoid repeated Buffer.from on every data chunk)
const TRZSZ_MAGIC_KEY_PREFIX_BUFFER = Buffer.from('::TRZSZ:TRANSFER:')
const TRZSZ_SUCCESS_BUFFER = Buffer.from('Success')
const TRZSZ_SAVED_BUFFER = Buffer.from('Saved')
const TRZSZ_SAVED_FILE_BUFFER = Buffer.from('Saved file')
const TRZSZ_SAVED_DIR_BUFFER = Buffer.from('Saved directory')
const TRZSZ_DATA_HEADER_BUFFER = Buffer.from('#DATA:')
// Tuning constants
const READ_CHUNK_SIZE = 10 * 1024 * 1024 // 10MB default buffer (matches trzsz default -B bufsize)
const WRITE_HIGH_WATER_MARK = 10 * 1024 * 1024 // 10MB write buffer before backpressure
const PROGRESS_INTERVAL_MS = 300 // Progress update throttle (ms)
const COMPLETION_TIMEOUT_MS = 5000 // Timeout waiting for server "Success"
/**
 * Optimized FileReader - uses async I/O with adaptive buffer sizing
 */
class FileReader {
  constructor (filePath, fileName) {
    this.filePath = filePath
    this.fileName = fileName
    this.fileHandle = null
    this.size = 0
    this.offset = 0
    this.pathId = 0
    this.relPath = [fileName]
    this.isDirectory = false
  }

  async open () {
    const stats = fs.statSync(this.filePath)
    this.size = stats.size
    // Use fs.promises for non-blocking open
    this.fileHandle = await open(this.filePath, 'r')
  }

  getPathId () { return this.pathId }
  getRelPath () { return this.relPath }
  isDir () { return this.isDirectory }
  getSize () { return this.size }
  async readFile (buf) {
    const requestedSize = buf ? buf.byteLength : READ_CHUNK_SIZE
    const target = Buffer.allocUnsafe(requestedSize)
    const { bytesRead } = await this.fileHandle.read(target, 0, requestedSize, this.offset)
    this.offset += bytesRead
    if (bytesRead === 0) {
      return new Uint8Array(0)
    }
    return new Uint8Array(target.buffer, target.byteOffset, bytesRead)
  }

  async closeFile () {
    if (this.fileHandle !== null) {
      await this.fileHandle.close().catch(() => {})
      this.fileHandle = null
    }
  }
}

/**
 * Optimized FileWriter - buffered writes with backpressure handling
 */
class FileWriter {
  constructor (filePath, fileName) {
    this.filePath = filePath
    this.fileName = fileName
    this.localName = fileName
    this.isDirectory = false
    this.writeStream = null
    this._drainPromise = null
  }

  getFileName () { return this.fileName }
  getLocalName () { return this.localName }
  isDir () { return this.isDirectory }
  /**
   * Ensure write stream is created with optimized settings
   */
  _ensureStream () {
    if (this.writeStream === null) {
      this.writeStream = fs.createWriteStream(this.filePath, {
        highWaterMark: WRITE_HIGH_WATER_MARK,
        // Use 'w' flag explicitly for clarity
        flags: 'w'
      })
      // Pre-bind error handler
      this.writeStream.on('error', (err) => {
        log.error('FileWriter stream error:', err)
      })
    }
  }

  /**
   * Write data with backpressure handling
   * Returns immediately if buffer has capacity, waits for drain if full
   */
  async writeFile (buf) {
    this._ensureStream()
    // Write returns false when internal buffer is full (backpressure)
    const canContinue = this.writeStream.write(buf)
    if (!canContinue) {
      // Wait for drain event before accepting more writes
      // This prevents unbounded memory growth for fast producers
      if (!this._drainPromise) {
        this._drainPromise = new Promise((resolve) => {
          this.writeStream.once('drain', () => {
            this._drainPromise = null
            resolve()
          })
        })
      }
      await this._drainPromise
    }
  }

  async deleteFile () {
    await this._closeStream()
    return this.filePath
  }

  async _closeStream () {
    if (this.writeStream !== null) {
      return new Promise((resolve) => {
        this.writeStream.end(() => {
          this.writeStream = null
          resolve()
        })
      })
    }
  }

  async closeFile () {
    await this._closeStream()
  }
}
/**
 * Optimized TrzszSession - event-driven, minimal allocations
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
    this.lastProgressUpdate = 0
    this._pendingComplete = null
    this.completedFiles = []
    this.totalBytes = 0
    this.transferStartTime = 0
    this._completionTimeout = null
    this._filesResolve = null
  }

  /**
   * Detect trzsz magic key in data buffer
   * Optimized: avoids string conversion, uses buffer indexOf directly
   */
  detectTrzszStart (data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const idx = buf.indexOf(TRZSZ_MAGIC_KEY_PREFIX_BUFFER)
    if (idx < 0) return null
    const afterPrefix = idx + TRZSZ_MAGIC_KEY_PREFIX_BUFFER.length
    if (afterPrefix >= buf.length) return null
    const direction = buf[afterPrefix]
    // 'R' = 82, 'S' = 83
    if (direction === 82) return { type: 'send', offset: idx }
    if (direction === 83) return { type: 'receive', offset: idx }
    return null
  }

  /**
   * Send message to client via websocket
   */
  sendToClient (msg) {
    if (this.ws && this.ws.s) {
      this.ws.s({ action: 'trzsz-event', ...msg })
    }
  }

  /**
   * Handle incoming data from terminal
   * Returns true if data was consumed by trzsz
   */
  handleData (data) {
    if (this.state === TRZSZ_STATE.WAITING_SAVE_PATH) {
      this.pendingData.push(data)
      return true
    }
    if (this._pendingComplete) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
      if (buf.indexOf(TRZSZ_SUCCESS_BUFFER) >= 0) {
        this.sendToClient(this._pendingComplete)
        this._pendingComplete = null
        this.endSession()
        return true
      }
      if (buf.indexOf(TRZSZ_SAVED_BUFFER) >= 0) {
        this.endSession()
        return true
      }
      if (this.transfer) {
        this.transfer.addReceivedData(data)
        return true
      }
    }
    if (this.state === TRZSZ_STATE.RECEIVING || this.state === TRZSZ_STATE.SENDING) {
      this.transfer.addReceivedData(data)
      return true
    }
    const detected = this.detectTrzszStart(data)
    if (detected) {
      if (detected.type === 'receive') {
        this.startReceiver()
        this.transfer.addReceivedData(data)
      } else if (detected.type === 'send') {
        this.createTransfer()
        this.state = TRZSZ_STATE.SENDING
        this.transfer.addReceivedData(data)
        this.startUploadProcess()
      }
      return true
    }
    return false
  }

  /**
   * Wait for files using event-driven approach (no polling)
   */
  _waitForFiles () {
    if (this.pendingFiles.length > 0) {
      return Promise.resolve(this.pendingFiles)
    }
    return new Promise((resolve) => {
      this._filesResolve = resolve
    })
  }

  /**
   * Upload process - optimized with event-driven file selection
   */
  async startUploadProcess () {
    try {
      this.completedFiles = []
      this.totalBytes = 0
      this.transferStartTime = 0
      await this.transfer.sendAction(true, false)
      this.sendToClient({
        event: 'send-start',
        message: 'TRZSZ send session started, please select files'
      })
      await this.transfer.recvConfig()
      // Event-driven wait instead of polling
      const files = await this._waitForFiles()
      if (this.state !== TRZSZ_STATE.SENDING) return
      // Open all files concurrently
      this.fileReaders = files.map(file => {
        const filePath = typeof file === 'string' ? file : file.path
        return new FileReader(filePath, path.basename(filePath))
      })
      await Promise.all(this.fileReaders.map(r => r.open()))
      this.totalBytes = this.fileReaders.reduce((sum, r) => sum + r.size, 0)
      this.transferStartTime = Date.now()
      const progressCallback = this._createProgressCallback('upload')
      const remoteNames = await this.transfer.sendFiles(this.fileReaders, progressCallback)
      const totalElapsed = this.transferStartTime > 0
        ? (Date.now() - this.transferStartTime) / 1000
        : 0
      this._pendingComplete = {
        event: 'session-complete',
        message: 'Upload complete',
        files: remoteNames,
        totalBytes: this.totalBytes,
        totalElapsed,
        avgSpeed: totalElapsed > 0 ? Math.round(this.totalBytes / totalElapsed) : 0,
        completedFiles: this.completedFiles
      }
      this._completionTimeout = setTimeout(() => {
        if (this._pendingComplete) {
          log.warn('Trzsz upload: timeout waiting for server response, auto-ending session')
          this.sendToClient(this._pendingComplete)
          this._pendingComplete = null
          this.endSession()
        }
      }, COMPLETION_TIMEOUT_MS)
      await this.transfer.clientExit('Success')
      // Close readers concurrently
      await Promise.all(this.fileReaders.map(r => r.closeFile()))
      this.state = TRZSZ_STATE.IDLE
    } catch (err) {
      log.error('Trzsz upload error:', err)
      this.sendToClient({ event: 'session-error', error: err.message })
      this.endSession()
    }
  }

  /**
   * Create shared progress callback - avoids duplicating callback logic
   */
  _createProgressCallback (type) {
    return {
      onNum: (num) => {
        this.sendToClient({ event: 'file-count', count: num })
      },
      onName: (name) => {
        if (this.currentTransfer && this.currentTransfer.size > 0) {
          this.completedFiles.push({
            name: this.currentTransfer.name,
            size: this.currentTransfer.size,
            ...(type === 'download' ? { path: this.downloadPath } : {})
          })
          if (type === 'download') {
            this.totalBytes += this.currentTransfer.size
          }
        }
        this.currentTransfer = { name, size: 0 }
        if (!this.transferStartTime) {
          this.transferStartTime = Date.now()
        }
        this.startTime = Date.now()
        this.sendToClient({ event: 'file-start', name, size: 0 })
      },
      onSize: (size) => {
        if (this.currentTransfer) this.currentTransfer.size = size
        this.transferSize = size
        this.sendToClient({ event: 'file-size', name: this.currentTransfer?.name, size })
      },
      onStep: (step) => {
        this.transferredBytes = step
        const now = Date.now()
        if (now - this.lastProgressUpdate > PROGRESS_INTERVAL_MS) {
          this.lastProgressUpdate = now
          this.sendProgress()
        }
      },
      onDone: () => {
        if (this.currentTransfer && this.currentTransfer.size > 0) {
          this.completedFiles.push({
            name: this.currentTransfer.name,
            size: this.currentTransfer.size,
            ...(type === 'download' ? { path: this.downloadPath } : {})
          })
          if (type === 'download') {
            this.totalBytes += this.currentTransfer.size
          }
        }
        this.sendToClient({
          event: 'file-complete',
          name: this.currentTransfer?.name,
          path: type === 'download' ? this.downloadPath : this.uploadPath
        })
      }
    }
  }

  createTransfer () {
    let pendingHeader = null
    this.transfer = new TrzszTransfer((data) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'binary') : (Buffer.isBuffer(data) ? data : Buffer.from(data))
      if (buf.length < 200) {
        if (buf.indexOf(TRZSZ_SAVED_FILE_BUFFER) >= 0 || buf.indexOf(TRZSZ_SAVED_DIR_BUFFER) >= 0) {
          return
        }
        if (buf.length >= 6 && buf.indexOf(TRZSZ_DATA_HEADER_BUFFER) === 0) {
          pendingHeader = buf
          return
        }
      }
      if (pendingHeader) {
        const combined = Buffer.concat([pendingHeader, buf])
        pendingHeader = null
        this.writeToTerminal(combined)
      } else {
        this.writeToTerminal(buf)
      }
    }, false)
    return this.transfer
  }

  startReceiver () {
    try {
      this.createTransfer()
      this.completedFiles = []
      this.totalBytes = 0
      this.transferStartTime = 0
      this.state = TRZSZ_STATE.WAITING_SAVE_PATH
      this.sendToClient({
        event: 'receive-start',
        message: 'TRZSZ receive session started'
      })
    } catch (e) {
      log.error('Failed to start trzsz receiver', e)
      this.endSession()
    }
  }

  async processPendingData () {
    if (this.state !== TRZSZ_STATE.WAITING_SAVE_PATH) return
    this.state = TRZSZ_STATE.RECEIVING
    try {
      await this.transfer.sendAction(true, false)
      await this.transfer.recvConfig()
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
        this.currentTransfer = { name: fileName, size: 0 }
        this.downloadPath = filePath
        this.transferredBytes = 0
        this.startTime = Date.now()
        this.sendToClient({ event: 'file-start', name: fileName, size: 0 })
        return writer
      }
      const progressCallback = this._createProgressCallback('download')
      // Feed all pending data at once
      for (const data of this.pendingData) {
        this.transfer.addReceivedData(data)
      }
      this.pendingData = []
      const savedFiles = await this.transfer.recvFiles(
        downloadDir,
        openSaveFile,
        progressCallback
      )
      const savedFilePaths = savedFiles.map(name => path.join(downloadDir, name))
      // Close all writers concurrently
      await Promise.all(this.fileWriters.map(w => w.closeFile()))
      const totalElapsed = this.transferStartTime > 0
        ? (Date.now() - this.transferStartTime) / 1000
        : 0
      this._pendingComplete = {
        event: 'session-complete',
        message: 'Download complete',
        files: savedFilePaths,
        savePath: downloadDir,
        totalBytes: this.totalBytes,
        totalElapsed,
        avgSpeed: totalElapsed > 0 ? Math.round(this.totalBytes / totalElapsed) : 0,
        completedFiles: this.completedFiles
      }
      this._completionTimeout = setTimeout(() => {
        if (this._pendingComplete) {
          log.warn('Trzsz download: timeout waiting for server response, auto-ending session')
          this.sendToClient(this._pendingComplete)
          this._pendingComplete = null
          this.endSession()
        }
      }, COMPLETION_TIMEOUT_MS)
      this.state = TRZSZ_STATE.IDLE
      await this.transfer.clientExit('Success')
    } catch (err) {
      log.error('Trzsz download error:', err)
      this.sendToClient({ event: 'session-error', error: err.message })
      this.endSession()
    }
  }

  getUniqueFilePath (dir, fileName) {
    let filePath = path.join(dir, fileName)
    if (!fs.existsSync(filePath)) return filePath
    const ext = path.extname(fileName)
    const baseName = path.basename(fileName, ext)
    let counter = 1
    while (fs.existsSync(filePath)) {
      filePath = path.join(dir, `${baseName}.${counter}${ext}`)
      counter++
    }
    return filePath
  }

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

  setSavePath (savePath) {
    this.savePath = savePath
    this.processPendingData()
  }

  /**
   * Set files to send - event-driven (resolves the waiting promise immediately)
   */
  setSendFiles (files) {
    this.pendingFiles = files
    if (this._filesResolve) {
      this._filesResolve(files)
      this._filesResolve = null
    }
  }

  writeToTerminal (data) {
    if (this.term && this.term.write) {
      this.term.write(data)
    }
  }

  endSession () {
    if (this._completionTimeout) {
      clearTimeout(this._completionTimeout)
      this._completionTimeout = null
    }
    if (this._filesResolve) {
      this._filesResolve([])
      this._filesResolve = null
    }
    for (const writer of this.fileWriters) {
      try { writer.closeFile() } catch (e) { log.error('Error closing file writer', e) }
    }
    for (const reader of this.fileReaders) {
      try { reader.closeFile() } catch (e) { log.error('Error closing file reader', e) }
    }
    if (this.transfer) {
      try { this.transfer.cleanup() } catch (e) { log.error('Error cleaning up transfer', e) }
    }
    this.sendToClient({ event: 'session-end' })
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
    this.completedFiles = []
    this.totalBytes = 0
    this.transferStartTime = 0
    this._pendingComplete = null
  }

  async cancel () {
    if (this.transfer) {
      try { await this.transfer.stopTransferring() } catch (e) { log.error('Error stopping transfer', e) }
    }
    this.endSession()
  }

  isActive () {
    return this.state !== TRZSZ_STATE.IDLE || this._pendingComplete !== null
  }

  destroy () {
    this.endSession()
    this.term = null
    this.ws = null
  }
}
/**
 * TrzszManager - manages sessions per terminal (unchanged API)
 */
class TrzszManager {
  constructor () {
    this.sessions = new Map()
  }

  getSession (pid, term, ws) {
    if (!this.sessions.has(pid)) {
      this.sessions.set(pid, new TrzszSession(term, ws))
    }
    return this.sessions.get(pid)
  }

  handleData (pid, data, term, ws) {
    return this.getSession(pid, term, ws).handleData(data)
  }

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
const trzszManager = new TrzszManager()
module.exports = { trzszManager }
