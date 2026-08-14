import { loadAttachAddon } from './xterm-loader.js'

export default class AttachAddonCustom {
  constructor (term, socket, isWindowsShell) {
    this.term = term
    this.socket = socket
    this.isWindowsShell = isWindowsShell
    this.outputSuppressed = false
    this.suppressedData = []
    this.suppressTimeout = null
    this.onSuppressionEndCallback = null
    this.hasReceivedInitialData = false
    this.onInitialDataCallback = null
    this._bidirectional = true
    this._disposables = []
    this._socket = socket
    this.decoder = new TextDecoder('utf-8')
    this._lastDataTime = Date.now()
    this._lastInputTime = Date.now()
    this._keepaliveTimer = null
    this._keepaliveInterval = 3000
    this._lastOutputLine = ''
    this._passwordPromptDetected = false
    this._pendingEchoCheck = null
    this._echoCheckTimer = null
    // Write coalescing: terminal output is buffered and flushed on a short
    // timer so that heavy bursts (e.g. `yum install` download progress, which
    // rewrites the same line with \r + clear-line thousands of times per
    // second) collapse into a few term.write() calls per frame instead of
    // blocking the main thread on every WebSocket message.
    this._writeBuffer = []
    this._bufferBytes = 0
    this._flushScheduled = false
    this._flushTimer = null
    // Coalescing window. Output is flushed at most once per interval.
    // 16ms ~= one frame; low enough that interactive echo feels instant,
    // high enough to merge a multi-MB/s flood into ~60 writes/s.
    this._flushIntervalMs = 16
    // Time of the last actual flush. Drives the interactive fast path in
    // _enqueueWrite: output arriving after an idle gap (keystroke echo,
    // command result) is flushed immediately instead of paying the
    // coalescing delay. 0 = the first chunk ever flushes immediately.
    this._lastFlushTime = 0
    // Soft cap on buffered-but-unflushed bytes. Under a sustained flood the
    // producer outruns the renderer; once pending output exceeds this we drop
    // the OLDEST data (preserving the newest, visible tail and the line
    // currently being rewritten). Normal interactive output is many orders of
    // magnitude smaller and is never dropped.
    this._maxBufferBytes = 256 * 1024
    this._droppedBytes = 0
    this._droppedWarned = false
  }

  _initBase = async () => {
    const AttachAddon = await loadAttachAddon()
    const base = new AttachAddon(this._socket, { bidirectional: this._bidirectional })
    this._sendData = base._sendData.bind(base)
  }

  onInitialData = (callback) => {
    if (this.hasReceivedInitialData) {
      callback()
    } else {
      this.onInitialDataCallback = callback
    }
  }

  startOutputSuppression = (timeout = 3000, onEnd = null, discardOnTimeout = false) => {
    this.outputSuppressed = true
    this.suppressedData = []
    this.onSuppressionEndCallback = onEnd
    this.suppressTimeout = setTimeout(() => {
      if (!discardOnTimeout) {
        console.warn('[AttachAddon] Output suppression timeout reached, resuming')
      }
      this.stopOutputSuppression(discardOnTimeout)
    }, timeout)
  }

  stopOutputSuppression = (discard = true) => {
    if (this.suppressTimeout) {
      clearTimeout(this.suppressTimeout)
      this.suppressTimeout = null
    }
    this.outputSuppressed = false

    if (!discard && this.suppressedData.length > 0) {
      for (const data of this.suppressedData) {
        this.writeToTerminalDirect(data)
      }
    }
    this.suppressedData = []

    if (this.onSuppressionEndCallback) {
      const callback = this.onSuppressionEndCallback
      this.onSuppressionEndCallback = null
      callback()
    }
  }

  onShellIntegrationDetected = () => {
    if (this.outputSuppressed) {
      this.stopOutputSuppression(true)
    }
  }

  activate = async (terminal = this.term) => {
    await this._initBase()
    this.addSocketListener(this._socket, 'message', this.onMsg)

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => this.sendToServer(data)))
      this._disposables.push(terminal.onBinary((data) => this.sendToServer(new Uint8Array(data))))
    }

    this._disposables.push(this.addSocketListener(this._socket, 'close', () => this.dispose()))
    this._disposables.push(this.addSocketListener(this._socket, 'error', () => this.dispose()))
  }

  onMsg = (ev) => {
    this._lastDataTime = Date.now()
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.action === 'zmodem-event' || msg.action === 'trzsz-event' || msg.action === 'xmodem-event') {
          return
        }
      } catch (e) {}
    }

    this.writeToTerminal(ev.data)
  }

  static passwordPromptPatterns = [
    /password\s*[:\]>]\s*$/i,
    /\[sudo\]\s*password\s+for\s+\S+\s*:\s*$/i,
    /enter\s+passphrase/i,
    /enter\s+password/i,
    /密码[：:]\s*$/,
    /パスワード[：:]\s*$/,
    /mot de passe\s*[:\]]\s*$/i,
    /passwort[:\]]\s*$/i,
    /contraseña[:\]]\s*$/i
  ]

  _checkPasswordPrompt = (str) => {
    // Extract last non-empty line from the output
    const lines = str.split(/\r?\n|\r/)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line) {
        this._lastOutputLine = line
        break
      }
    }
    return AttachAddonCustom.passwordPromptPatterns.some(
      p => p.test(this._lastOutputLine)
    )
  }

  _onEchoCheckTimeout = () => {
    // No echo received within timeout → confirms password mode
    this._pendingEchoCheck = null
  }

  _handleEchoDetection = (str) => {
    if (this._pendingEchoCheck) {
      // Server sent data back while we were waiting → echo is ON → not password
      if (str.includes(this._pendingEchoCheck.char)) {
        this._passwordPromptDetected = false
        clearTimeout(this._echoCheckTimer)
        this._pendingEchoCheck = null
        this._echoCheckTimer = null
        // Cancel the password dropdown if it was shown
        this.term?.parent?.onPasswordPromptCancelled?.()
      }
    }
  }

  checkForShellIntegration = (str) => {
    const ESC = String.fromCharCode(27)
    return str.includes(ESC + ']633;')
  }

  writeToTerminalDirect = (data) => {
    const { term } = this
    if (term.parent?.onZmodem) {
      return
    }
    if (typeof data === 'string') {
      return term.write(data)
    }
    term?.write(data)
  }

  writeToTerminal = (data) => {
    const { term } = this
    if (term.parent?.onZmodem) {
      return
    }

    if (!this.hasReceivedInitialData) {
      this.hasReceivedInitialData = true
      if (this.onInitialDataCallback) {
        const callback = this.onInitialDataCallback
        this.onInitialDataCallback = null
        setTimeout(callback, 0)
      }
    }

    // Decode once, synchronously. The previous implementation routed binary
    // chunks through `new Blob()` + `FileReader.readAsArrayBuffer()` and decoded
    // in an async `onRead` callback; that async round-trip (plus a per-chunk
    // Blob allocation) showed up in the profile and fragmented main-thread work.
    // We already hold a TextDecoder, so decode inline like the suppression path.
    let str = data
    if (typeof data !== 'string') {
      try {
        // Decode in streaming mode: slow SSH servers (e.g. embedded router
        // CLIs) often deliver a multi-byte UTF-8 char (CJK = 3 bytes) split
        // across TCP segments, and the server-side idle fast path may forward
        // the first segment immediately. Without { stream: true } the decoder
        // would turn each partial fragment into U+FFFD instead of carrying the
        // trailing bytes over to the next chunk and reassembling the char.
        str = this.decoder.decode(
          data instanceof ArrayBuffer ? data : new Uint8Array(data),
          { stream: true }
        )
      } catch (e) {
        str = ''
      }
    }

    if (this.outputSuppressed) {
      if (this.checkForShellIntegration(str)) {
        this.onShellIntegrationDetected()
        return
      }
      this.suppressedData.push(data)
      return
    }

    // Prompt/echo detection runs per chunk (cheap) so password prompts and
    // shell integration are still detected promptly.
    this._handleEchoDetection(str)
    if (this._checkPasswordPrompt(str) && !this._passwordPromptDetected) {
      this._passwordPromptDetected = true
      // Show password dropdown immediately after terminal renders the prompt
      setTimeout(() => {
        this.term?.parent?.onPasswordPromptDetected?.()
      }, 100)
    }

    // Coalesce the actual write (see _enqueueWrite). notifyOnData /
    // onTerminalWrite fire once per flush instead of once per chunk.
    this._enqueueWrite(str)
  }

  // Buffer decoded output and flush it on a short timer so a burst of messages
  // becomes a single (size-capped) term.write() call, keeping the main thread
  // free to handle UI events and input between flushes.
  _enqueueWrite = (str) => {
    if (!this.term || !str) {
      return
    }
    this._writeBuffer.push(str)
    this._bufferBytes += str.length
    if (this._bufferBytes > this._maxBufferBytes) {
      this._dropOldestUntil()
    }
    // A hidden window gets its timers throttled by Chromium (Electron's
    // backgroundThrottling defaults to true), which would stall the flush
    // timer and force the byte cap to drop real output. Nothing is painted
    // while hidden, so coalescing buys nothing — flush synchronously.
    if (document.hidden) {
      clearTimeout(this._flushTimer)
      this._flushWrites()
      return
    }
    // Interactive fast path: if the last flush was longer ago than the
    // coalescing window (keystroke echo, command result after idle), flush
    // immediately so typing adds zero latency. Only output arriving inside
    // a burst window pays the coalescing delay — which is exactly the flood
    // case coalescing exists for.
    const elapsed = Date.now() - this._lastFlushTime
    if (elapsed >= this._flushIntervalMs) {
      clearTimeout(this._flushTimer)
      this._flushWrites()
      return
    }
    if (!this._flushScheduled) {
      this._flushScheduled = true
      this._flushTimer = setTimeout(this._flushWrites, this._flushIntervalMs - elapsed)
    }
  }

  // Under heavy flood the producer outruns the renderer; once pending output
  // exceeds the cap we drop the OLDEST chunks (preserving the newest, visible
  // tail and the line currently being rewritten). The first kept chunk is
  // trimmed to the next newline so we never render a half line / broken escape.
  _dropOldestUntil = () => {
    const buf = this._writeBuffer
    let kept = 0
    let cutIdx = buf.length
    for (let i = buf.length - 1; i >= 0; i--) {
      if (kept + buf[i].length > this._maxBufferBytes) {
        cutIdx = i + 1
        break
      }
      kept += buf[i].length
    }
    if (cutIdx <= 0) {
      return
    }
    let dropped = 0
    for (let i = 0; i < cutIdx; i++) {
      dropped += buf[i].length
    }
    if (cutIdx < buf.length) {
      const first = buf[cutIdx]
      const nl = first.indexOf('\n')
      if (nl >= 0 && nl < first.length - 1) {
        dropped += nl + 1
        buf[cutIdx] = first.slice(nl + 1)
      } else {
        dropped += buf[cutIdx].length
        cutIdx += 1
      }
    }
    this._writeBuffer = buf.slice(cutIdx)
    this._bufferBytes -= dropped
    this._droppedBytes += dropped
    if (!this._droppedWarned) {
      this._droppedWarned = true
      console.warn('[AttachAddon] Heavy output detected; coalescing writes and dropping intermediate output to keep the UI responsive.')
    }
  }

  _flushWrites = () => {
    this._flushScheduled = false
    this._flushTimer = null
    const buf = this._writeBuffer
    if (!buf.length || !this.term) {
      this._writeBuffer = []
      this._bufferBytes = 0
      return
    }
    this._writeBuffer = []
    this._bufferBytes = 0
    const data = buf.length === 1 ? buf[0] : buf.join('')
    const { term } = this
    this._lastFlushTime = Date.now()
    term.write(data)
    // Notify parent that the terminal buffer has been updated (echo received),
    // once per flush instead of once per chunk.
    term?.parent?.notifyOnData()
    term?.parent?.onTerminalWrite?.()
  }

  sendToServer = (data) => {
    this._lastInputTime = Date.now()
    // Start echo detection when password prompt is suspected
    if (this._passwordPromptDetected && !this._pendingEchoCheck && data !== '\r' && data !== '\n' && data !== '\x03') {
      this._pendingEchoCheck = { char: data, time: Date.now() }
      clearTimeout(this._echoCheckTimer)
      this._echoCheckTimer = setTimeout(this._onEchoCheckTimeout, 200)
    }
    // Reset password state on Enter or Ctrl+C
    if (data === '\r' || data === '\n' || data === '\x03') {
      if (this._passwordPromptDetected) {
        this.term?.parent?.onPasswordPromptCancelled?.()
      }
      this._passwordPromptDetected = false
      this._lastOutputLine = ''
      this._pendingEchoCheck = null
      clearTimeout(this._echoCheckTimer)
      this._echoCheckTimer = null
    }
    this._sendData(data)
  }

  _startKeepalive = () => {
    this._stopKeepalive()
    this._keepaliveTimer = setInterval(this._checkKeepalive, this._keepaliveInterval)
  }

  _stopKeepalive = () => {
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer)
      this._keepaliveTimer = null
    }
  }

  _checkKeepalive = () => {
    if (this.outputSuppressed) {
      return
    }
    const now = Date.now()
    const idleSinceData = now - this._lastDataTime
    const idleSinceInput = now - this._lastInputTime
    if (idleSinceData >= this._keepaliveInterval && idleSinceInput >= this._keepaliveInterval) {
      // Tell the server to write \n to the PTY so bash's read() wakes up and
      // resets the TMOUT alarm. The user has explicitly enabled keepalive and
      // accepts the side-effect of an occasional echoed newline / re-prompt.
      // Start output suppression to hide the echoed prompt.
      const sock = this._socket
      if (sock && sock.readyState === 1 /* OPEN */) {
        this.startOutputSuppression(500, null, true)
        sock.send(JSON.stringify({ action: 'keepalive' }))
      }
    }
  }

  setKeepalive = (enabled) => {
    if (enabled) {
      this._startKeepalive()
    } else {
      this._stopKeepalive()
    }
  }

  addSocketListener = (socket, type, handler) => {
    socket.addEventListener(type, handler)
    return {
      dispose: () => {
        if (!handler) {
          return
        }
        socket.removeEventListener(type, handler)
      }
    }
  }

  dispose = () => {
    this._stopKeepalive()
    clearTimeout(this._echoCheckTimer)
    this._echoCheckTimer = null
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }
    this._flushScheduled = false
    this._writeBuffer = []
    this._bufferBytes = 0
    // Reset the streaming decoder so any partial multi-byte sequence held
    // over from this connection can not leak into a reused instance.
    this.decoder = new TextDecoder('utf-8')
    this.term = null
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}
