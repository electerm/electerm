/**
 * Optimized Trzsz protocol handler for server-side terminal sessions
 * Uses trzsz2 (pure JS) for protocol implementation
 *
 * Performance improvements over original:
 * 1. CFG message bufsize injection — the trzsz2 library sends a small default bufsize
 *    (~6-8 KB) in the #CFG: config message to the remote tsz/trz server. With 50ms RTT,
 *    that yields only ~130 kB/s. We intercept the config in the write callback and
 *    replace bufsize with 10MB, pushing throughput toward network limits.
 * 2. Immediate write-through in TrzszTransfer callback — no pendingHeader buffering.
 *    The old code held back #DATA: header lines until the next write callback, which
 *    starved the remote of data during async readFile() calls and added a full
 *    event-loop round-trip of latency per chunk.
 * 3. Read-ahead buffer in FileReader — always reads READ_CHUNK_SIZE from disk and
 *    serves small requests from cache, amortizing async/event-loop overhead across
 *    many chunk requests from the trzsz2 library.
 * 4. Reusable pre-allocated read buffer — avoids per-read Buffer.allocUnsafe() GC churn.
 * 5. Write buffering with backpressure handling (drain events) for downloads.
 * 6. Event-driven file selection instead of polling loop.
 * 7. Batched progress updates with configurable interval.
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
// The #CFG: line is the config message sent by us (the receiver) to the remote sender.
// It carries a base64-encoded JSON with fields like bufsize, timeout, escape, etc.
// We intercept it to inject a large bufsize so the remote sends big chunks.
const TRZSZ_CFG_HEADER = '#CFG:'
const TRZSZ_CFG_HEADER_BUFFER = Buffer.from(TRZSZ_CFG_HEADER)
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
    this._cacheBuffer = null
    this._cacheOffset = 0
    this._cacheEnd = 0
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
    // KEY PERFORMANCE FIX: Always return READ_CHUNK_SIZE bytes, not buf.byteLength.
    //
    // trzsz2 passes `buf` as a size *hint* for pre-allocation. The RETURNED buffer's
    // actual length is what trzsz2 uses as the protocol block size. If we return tiny
    // buffers (e.g. buf.byteLength = 10KB), the protocol uses 10KB blocks and at
    // 20ms RTT we get ~500 kB/s. If we return 10MB blocks, speed rises ~1000x to
    // network-limited throughput. This is the single biggest performance lever.
    if (this._cacheBuffer && this._cacheOffset < this._cacheEnd) {
      // Serve the full remaining cache in one shot — don't split by buf.byteLength
      const available = this._cacheEnd - this._cacheOffset
      const result = new Uint8Array(this._cacheBuffer.buffer, this._cacheBuffer.byteOffset + this._cacheOffset, available)
      this._cacheOffset = this._cacheEnd
      this.offset += available
      return result
    }

    const remaining = this.size - this.offset
    if (remaining <= 0) return new Uint8Array(0)

    const readSize = Math.min(READ_CHUNK_SIZE, remaining)
    if (!this._cacheBuffer || this._cacheBuffer.byteLength < readSize) {
      this._cacheBuffer = Buffer.allocUnsafe(readSize)
    }
    const { bytesRead } = await this.fileHandle.read(this._cacheBuffer, 0, readSize, this.offset)
    if (bytesRead === 0) return new Uint8Array(0)

    this.offset += bytesRead
    // Mark cache as fully consumed (we're returning everything in one go)
    this._cacheOffset = bytesRead
    this._cacheEnd = bytesRead
    // Return the full read as a single large block
    return new Uint8Array(this._cacheBuffer.buffer, this._cacheBuffer.byteOffset, bytesRead)
  }

  async closeFile () {
    if (this.fileHandle !== null) {
      await this.fileHandle.close().catch(() => {})
      this.fileHandle = null
    }
    this._cacheBuffer = null
    this._cacheOffset = 0
    this._cacheEnd = 0
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
    this.lastProgressUpdate = 0
    this._pendingComplete = null
    this.completedFiles = []
    this.totalBytes = 0
    this.transferStartTime = 0
    this._completionTimeout = null
    this._filesResolve = null
    this._savePathResolve = null
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
    this.transfer = new TrzszTransfer((data) => {
      let buf = typeof data === 'string' ? Buffer.from(data, 'binary') : (Buffer.isBuffer(data) ? data : Buffer.from(data))

      // Suppress "Saved file" / "Saved directory" terminal noise — cosmetic status
      // lines from the remote that would clutter the terminal display.
      if (buf.length < 200) {
        if (buf.indexOf(TRZSZ_SAVED_FILE_BUFFER) >= 0 || buf.indexOf(TRZSZ_SAVED_DIR_BUFFER) >= 0) {
          return
        }
      }

      // === DOWNLOAD SPEED FIX: Intercept #CFG: and inject large bufsize ===
      // When we're the receiver (tsz on server → client downloading), we send a
      // #CFG: message to the remote with our desired chunk size (bufsize).
      // trzsz2's default bufsize is tiny (~6-8 KB), so at 50ms RTT the remote can
      // only send ~130 kB/s. By injecting bufsize=10MB, the remote sends large chunks
      // and throughput scales to near network limits.
      //
      // The message format is:  #CFG:<base64(json)>\n
      // We safely fall through to the original buf if parsing fails for any reason.
      const cfgIdx = buf.indexOf(TRZSZ_CFG_HEADER_BUFFER)
      if (cfgIdx >= 0) {
        try {
          const afterHeader = cfgIdx + TRZSZ_CFG_HEADER_BUFFER.length
          const newlineIdx = buf.indexOf(10, afterHeader) // 10 = '\n'
          const base64End = newlineIdx >= 0 ? newlineIdx : buf.length
          const base64Part = buf.slice(afterHeader, base64End).toString().trim()
          if (base64Part.length > 0) {
            const configJson = Buffer.from(base64Part, 'base64').toString()
            const config = JSON.parse(configJson)
            if (typeof config.bufsize === 'number' && config.bufsize < READ_CHUNK_SIZE) {
              config.bufsize = READ_CHUNK_SIZE
              const newBase64 = Buffer.from(JSON.stringify(config)).toString('base64')
              const before = buf.slice(0, cfgIdx)
              const after = newlineIdx >= 0 ? buf.slice(newlineIdx) : Buffer.alloc(0)
              buf = Buffer.concat([before, Buffer.from(TRZSZ_CFG_HEADER + newBase64), after])
              log.debug('trzsz: injected bufsize', READ_CHUNK_SIZE, 'into #CFG config')
            }
          }
        } catch (e) {
          log.warn('trzsz: #CFG parse failed, using original config:', e.message)
        }
      }

      // Write immediately — no buffering. The previous pendingHeader approach held back
      // #DATA: lines until the next write callback, which caused a pipeline stall:
      // the remote couldn't receive (and ACK) the header while we were doing
      // an async readFile(), adding a full event-loop round-trip of latency per chunk.
      this.writeToTerminal(buf)
    }, false)
    return this.transfer
  }

  /**
   * Wait for save path using event-driven approach (no polling)
   */
  _waitForSavePath () {
    if (this.savePath) return Promise.resolve(this.savePath)
    return new Promise((resolve) => {
      this._savePathResolve = resolve
    })
  }

  startReceiver () {
    try {
      this.createTransfer()
      this.completedFiles = []
      this.totalBytes = 0
      this.transferStartTime = 0
      // Set to RECEIVING immediately — all incoming data goes directly to addReceivedData.
      // Previously WAITING_SAVE_PATH buffered data and delayed sendAction/recvConfig until
      // the user picked a save path, leaving the remote server idle. Now we handshake
      // immediately in parallel with the user selecting the path.
      this.state = TRZSZ_STATE.RECEIVING
      this.sendToClient({
        event: 'receive-start',
        message: 'TRZSZ receive session started'
      })
      // Fire-and-forget async handshake runs in parallel with save-path dialog
      this._runReceiverHandshake()
    } catch (e) {
      log.error('Failed to start trzsz receiver', e)
      this.endSession()
    }
  }

  async _runReceiverHandshake () {
    try {
      // Handshake happens immediately — remote gets our action ASAP and can start
      // sending its config without waiting for the UI dialog to complete.
      await this.transfer.sendAction(true, false)
      await this.transfer.recvConfig()
      // Wait for save path (user dialog) — in most cases the network RTT above
      // already consumed most of the dialog latency, so this resolves quickly.
      await this._waitForSavePath()
      if (this.state !== TRZSZ_STATE.RECEIVING) return
      await this._startFileReceiving()
    } catch (err) {
      log.error('Trzsz receiver handshake error:', err)
      this.sendToClient({ event: 'session-error', error: err.message })
      this.endSession()
    }
  }

  async _startFileReceiving () {
    try {
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
      const savedFiles = await this.transfer.recvFiles(
        downloadDir,
        openSaveFile,
        progressCallback
      )
      const savedFilePaths = savedFiles.map(name => path.join(downloadDir, name))
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
    if (this._savePathResolve) {
      this._savePathResolve(savePath)
      this._savePathResolve = null
    }
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
