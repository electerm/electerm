/**
 * Optimized Trzsz protocol handler for server-side terminal sessions
 */
const fs = require('fs')
const { open } = require('fs/promises')
const path = require('path')
const log = require('../common/log')
const sanitizeFilename = require('../common/sanitize-filename')
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
  }

  async open () {
    this.fileHandle = await open(this.filePath, 'r')
    this.size = (await this.fileHandle.stat()).size
  }

  getPathId () { return this.pathId }
  getRelPath () { return this.relPath }
  isDir () { return this.isDirectory }
  getSize () { return this.size }
  async readFile (buf) {
    const chunk = new Uint8Array(buf, 0, Math.min(buf.byteLength, this.size - this.offset))
    const { bytesRead } = await this.fileHandle.read(chunk, 0, chunk.length, this.offset)
    if (!bytesRead && this.offset < this.size) throw new Error('Unexpected end of file')
    this.offset += bytesRead
    return chunk.subarray(0, bytesRead)
  }

  async closeFile () {
    if (this.fileHandle !== null) {
      await this.fileHandle.close().catch(() => {})
      this.fileHandle = null
    }
  }
}

class FileWriter {
  constructor (fileHandle, filePath, fileName) {
    this.fileHandle = fileHandle
    this.filePath = filePath
    this.fileName = fileName
    this.closePromise = null
  }

  getFileName () { return this.fileName }
  getLocalName () { return path.basename(this.filePath) }
  isDir () { return false }

  async writeFile (buf) {
    // Await the write before the protocol reuses its receive buffer.
    await this.fileHandle.writeFile(buf)
  }

  closeFile () {
    if (!this.closePromise) this.closePromise = this.fileHandle.close()
    return this.closePromise
  }

  async deleteFile () {
    await this.closeFile()
    await fs.promises.unlink(this.filePath)
    return this.filePath
  }
}

class TrzszSession {
  constructor (term, ws) {
    this.magicSuffix = null
    this.readingMagicLine = false
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
      if (buf.includes(TRZSZ_SUCCESS_BUFFER) || buf.includes(TRZSZ_SAVED_BUFFER)) {
        this.sendToClient(this._pendingComplete)
        this._pendingComplete = null
        this.endSession()
        return true
      }
      if (this.transfer) {
        this.transfer.addReceivedData(data)
        return true
      }
    }
    if (this.state === TRZSZ_STATE.RECEIVING || this.state === TRZSZ_STATE.SENDING) {
      if (this.readingMagicLine) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        if (buf[0] === 35) {
          // Some peers start the first protocol frame directly after the marker.
          this.transfer.addReceivedData(buf)
        } else {
          const end = buf.indexOf(10)
          if (end < 0) return true
          if (end + 1 < buf.length) this.transfer.addReceivedData(buf.subarray(end + 1))
        }
        this.readingMagicLine = false
      } else {
        this.transfer.addReceivedData(data)
      }
      return true
    }
    let buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    if (this.magicSuffix) {
      buf = Buffer.concat([this.magicSuffix, buf])
      this.magicSuffix = null
    }
    const detected = this.detectTrzszStart(buf)
    if (detected) {
      const newlineIdx = buf.indexOf(10, detected.offset)
      this.readingMagicLine = newlineIdx < 0
      const trailing = (newlineIdx >= 0 && newlineIdx + 1 < buf.length)
        ? buf.slice(newlineIdx + 1)
        : null
      if (detected.type === 'receive') {
        this.startReceiver()
        if (trailing) this.transfer.addReceivedData(trailing)
      } else if (detected.type === 'send') {
        this.createTransfer()
        this.state = TRZSZ_STATE.SENDING
        if (trailing) this.transfer.addReceivedData(trailing)
        this.startUploadProcess()
      }
      return true
    }
    // Remember a possible split marker without delaying normal terminal output.
    const tail = buf.subarray(-TRZSZ_GO_MAGIC_KEY_PREFIX_BUFFER.length)
    const colon = tail.indexOf(58)
    if (colon >= 0) this.magicSuffix = Buffer.from(tail.subarray(colon))
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
    const transfer = this.transfer
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
      await transfer.recvConfig()
      if (this.transfer !== transfer) return

      const files = await this._waitForFiles()
      if (this.state !== TRZSZ_STATE.SENDING) return
      this.fileReaders = files.map(file => {
        const filePath = typeof file === 'string' ? file : file.path
        return new FileReader(filePath, path.basename(filePath))
      })
      for (const reader of this.fileReaders) {
        await reader.open()
        if (this.transfer !== transfer) {
          await reader.closeFile()
          return
        }
      }
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
      this.state = TRZSZ_STATE.IDLE
      await transfer.clientExit('Success')
    } catch (err) {
      if (this._cancelling || this.transfer !== transfer) {
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
        if (this.currentTransfer) {
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
      this.writeToTerminal(typeof data === 'string' ? data : Buffer.from(data))
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
    const transfer = this.transfer
    try {
      await this.transfer.sendAction(true, false)
      await transfer.recvConfig()
      if (this.transfer !== transfer) return
      await this._waitForSavePath()
      if (this.state !== TRZSZ_STATE.RECEIVING) return
      await this._startFileReceiving()
    } catch (err) {
      if (this._cancelling || this.transfer !== transfer) return
      log.error('Trzsz receiver handshake error:', err)
      this.sendToClient({ event: 'session-error', error: err.message })
      this.endSession()
    }
  }

  async _startFileReceiving () {
    const transfer = this.transfer
    try {
      const downloadDir = this.savePath
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true })
      }

      const openSaveFile = async (saveParam, fileName, directory, overwrite) => {
        const writer = await this.openDownloadFile(downloadDir, fileName)
        if (this.transfer !== transfer) {
          await writer.deleteFile()
          throw new Error('Transfer ended')
        }
        this.fileWriters.push(writer)
        this.downloadPath = writer.filePath
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
      if (this._cancelling || this.transfer !== transfer) {
        log.info('Trzsz download cancelled by user')
      } else {
        log.error('Trzsz download error:', err)
        this.sendToClient({ event: 'session-error', error: err.message })
        this.endSession()
      }
    }
  }

  async openDownloadFile (dir, fileName) {
    const safeName = sanitizeFilename(fileName)
    const ext = path.extname(safeName)
    const base = path.basename(safeName, ext)
    for (let i = 0; ; i++) {
      const filePath = path.join(dir, i ? `${base}.${i}${ext}` : safeName)
      try {
        return new FileWriter(await open(filePath, 'wx'), filePath, fileName)
      } catch (err) {
        if (err.code !== 'EEXIST') throw err
      }
    }
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
    if (this._savePathResolve) {
      this._savePathResolve(null)
      this._savePathResolve = null
    }
    for (const writer of this.fileWriters) {
      writer.closeFile().catch(e => log.error('Error closing file writer', e))
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
    this.magicSuffix = null
    this.readingMagicLine = false
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
    this.transfer?.stopTransferring()
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
module.exports = {
  TrzszSession,
  TrzszManager,
  trzszManager,
  TRZSZ_STATE
}
