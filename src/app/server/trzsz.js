/**
 * Optimized Trzsz protocol handler for server-side terminal sessions
 */
const fs = require('fs')
const { open } = require('fs/promises')
const path = require('path')
const log = require('../common/log')
const { TrzszTransfer } = require('trzsz2')

const TRZSZ_STATE = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path'
}
const TRZSZ_MAGIC_KEY_PREFIX_BUFFER = Buffer.from('::TRZSZ:TRANSFER:')
const TRZSZ_GO_MAGIC_KEY_PREFIX_BUFFER = Buffer.from('::TRZSZGO:TRANSFER:')
const TRZSZ_SUCCESS_BUFFER = Buffer.from('Success')
const TRZSZ_SAVED_BUFFER = Buffer.from('Saved')
const TRZSZ_SAVED_FILE_BUFFER = Buffer.from('Saved file')
const TRZSZ_SAVED_DIR_BUFFER = Buffer.from('Saved directory')
const READ_CHUNK_SIZE = 10 * 1024 * 1024
const WRITE_HIGH_WATER_MARK = 10 * 1024 * 1024
const PROGRESS_INTERVAL_MS = 300
const COMPLETION_TIMEOUT_MS = 5000
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
    this.fileHandle = await open(this.filePath, 'r')
  }

  getPathId () { return this.pathId }
  getRelPath () { return this.relPath }
  isDir () { return this.isDirectory }
  getSize () { return this.size }
  async readFile (buf) {
    if (this._cacheBuffer && this._cacheOffset < this._cacheEnd) {
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
    this._cacheOffset = bytesRead
    this._cacheEnd = bytesRead
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
  _ensureStream () {
    if (this.writeStream === null) {
      this.writeStream = fs.createWriteStream(this.filePath, {
        highWaterMark: WRITE_HIGH_WATER_MARK,
        flags: 'w'
      })
      this.writeStream.on('error', (err) => {
        log.error('FileWriter stream error:', err)
      })
    }
  }

  async writeFile (buf) {
    this._ensureStream()
    const canContinue = this.writeStream.write(buf)
    if (!canContinue) {
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
    this._noDelayEnabled = false
    this._cancelSuppressUntil = 0
    this._cancelSuppressTimeout = null
    this._cancelling = false
  }

  _setNoDelay (enabled) {
    const canToggle = this.term && typeof this.term.setNoDelay === 'function'
    if (!canToggle) return
    if (enabled && !this._noDelayEnabled) {
      this.term.setNoDelay(true)
      this._noDelayEnabled = true
      return
    }
    if (!enabled && this._noDelayEnabled) {
      this.term.setNoDelay(false)
      this._noDelayEnabled = false
    }
  }

  detectTrzszStart (data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    let idx = buf.indexOf(TRZSZ_MAGIC_KEY_PREFIX_BUFFER)
    let prefixLen = TRZSZ_MAGIC_KEY_PREFIX_BUFFER.length

    if (idx < 0) {
      idx = buf.indexOf(TRZSZ_GO_MAGIC_KEY_PREFIX_BUFFER)
      prefixLen = TRZSZ_GO_MAGIC_KEY_PREFIX_BUFFER.length
    }

    if (idx < 0) return null
    const afterPrefix = idx + prefixLen
    if (afterPrefix >= buf.length) return null
    const direction = buf[afterPrefix]
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
    // During cancel suppression window, absorb all data to prevent
    // protocol garbage from leaking to the terminal
    if (this._cancelSuppressUntil > 0) {
      if (Date.now() < this._cancelSuppressUntil) {
        return true
      }
      this._cancelSuppressUntil = 0
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

  _waitForFiles () {
    if (this.pendingFiles.length > 0) {
      return Promise.resolve(this.pendingFiles)
    }
    return new Promise((resolve) => {
      this._filesResolve = resolve
    })
  }

  async startUploadProcess () {
    try {
      this._cancelling = false
      this._setNoDelay(true)
      this.completedFiles = []
      this.totalBytes = 0
      this.transferStartTime = 0
      await this.transfer.sendAction(true, false)

      this.sendToClient({
        event: 'send-start',
        message: 'TRZSZ send session started, please select files'
      })
      await this.transfer.recvConfig()

      const files = await this._waitForFiles()
      if (this.state !== TRZSZ_STATE.SENDING) return
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
      await Promise.all(this.fileReaders.map(r => r.closeFile()))
      this.state = TRZSZ_STATE.IDLE
    } catch (err) {
      if (this._cancelling) {
        log.info('Trzsz upload cancelled by user')
      } else {
        log.error('Trzsz upload error:', err)
        this.sendToClient({ event: 'session-error', error: err.message })
        this.endSession()
      }
    }
  }

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
      if (typeof data === 'string') {
        if (
          data.length < 200 &&
          (data.includes('Saved file') || data.includes('Saved directory'))
        ) {
          return
        }
        this.writeToTerminal(data)
        return
      }

      if (Buffer.isBuffer(data)) {
        if (
          data.length < 200 &&
          (data.indexOf(TRZSZ_SAVED_FILE_BUFFER) >= 0 ||
          data.indexOf(TRZSZ_SAVED_DIR_BUFFER) >= 0)
        ) {
          return
        }
        this.writeToTerminal(data)
        return
      }

      this.writeToTerminal(data)
    }, false)

    return this.transfer
  }

  _waitForSavePath () {
    if (this.savePath) return Promise.resolve(this.savePath)
    return new Promise((resolve) => {
      this._savePathResolve = resolve
    })
  }

  startReceiver () {
    try {
      this._cancelling = false
      this._setNoDelay(true)
      this.createTransfer()
      this.completedFiles = []
      this.totalBytes = 0
      this.transferStartTime = 0
      this.state = TRZSZ_STATE.RECEIVING
      this.sendToClient({
        event: 'receive-start',
        message: 'TRZSZ receive session started'
      })
      this._runReceiverHandshake()
    } catch (e) {
      log.error('Failed to start trzsz receiver', e)
      this.endSession()
    }
  }

  async _runReceiverHandshake () {
    try {
      await this.transfer.sendAction(true, false)
      await this.transfer.recvConfig()
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
      if (this._cancelling) {
        log.info('Trzsz download cancelled by user')
      } else {
        log.error('Trzsz download error:', err)
        this.sendToClient({ event: 'session-error', error: err.message })
        this.endSession()
      }
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
    if (this._cancelSuppressTimeout) {
      clearTimeout(this._cancelSuppressTimeout)
      this._cancelSuppressTimeout = null
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
    this._setNoDelay(false)
  }

  async cancel () {
    const wasActive = this.state !== TRZSZ_STATE.IDLE
    // Set cancelling flag BEFORE stopTransferring so that the
    // catch blocks in startUploadProcess/_startFileReceiving
    // know not to send session-error to the client
    this._cancelling = true
    if (this.transfer) {
      try { await this.transfer.stopTransferring() } catch (e) { log.error('Error stopping transfer', e) }
    }
    this.endSession()
    if (wasActive) {
      // Suppress terminal output briefly to absorb any remaining
      // protocol data from the dying remote trzsz process
      const CANCEL_SUPPRESS_MS = 1000
      this._cancelSuppressUntil = Date.now() + CANCEL_SUPPRESS_MS
      this._cancelSuppressTimeout = setTimeout(() => {
        this._cancelSuppressUntil = 0
        this._cancelSuppressTimeout = null
        // Send Enter to elicit a fresh shell prompt after suppression ends
        this.writeToTerminal('\r')
      }, CANCEL_SUPPRESS_MS)
      // Send Ctrl+C to the remote terminal to kill the remote trzsz process
      // so it doesn't hang waiting for data and eventually timeout
      this.writeToTerminal('\x03')
    }
    // NOTE: do NOT reset _cancelling here — the async catch blocks
    // in startUploadProcess/_startFileReceiving fire on the next tick
    // and need to see the flag is still true.
  }

  isActive () {
    return this.state !== TRZSZ_STATE.IDLE || this._pendingComplete !== null || this._cancelSuppressUntil > 0
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
