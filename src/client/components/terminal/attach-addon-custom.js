import { loadAttachAddon } from './xterm-loader.js'

// Cursor-positioning sequences stripped from the head of surviving output
// after a drop. These are either relative (ESC[nA rewinds n rows) or restore
// state saved by content we just discarded (ESC[8 / CSI u); left in place
// they yank the cursor back into already-rendered history and overwrite it.
// Safe leading sequences (colours, erase, cursor visibility, etc.) are kept.
const ESC = String.fromCharCode(27)
const CURSOR_CSI_FINALS = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', '`', 'a', 'd', 'e', 'f', 's', 'u'
])
const CURSOR_ESC_FINALS = new Set(['7', '8', 'D', 'E', 'M'])

function ansiSequenceEnd (str, start) {
  const type = str[start + 1]
  if (!type) {
    return -1
  }
  if (type === '[') {
    for (let i = start + 2; i < str.length; i++) {
      const code = str.charCodeAt(i)
      if (code >= 0x40 && code <= 0x7e) {
        return i + 1
      }
    }
    return -1
  }
  if (type === ']' || type === 'P' || type === '^' || type === '_') {
    for (let i = start + 2; i < str.length; i++) {
      if (str.charCodeAt(i) === 7) {
        return i + 1
      }
      if (str[i] === ESC && str[i + 1] === '\\') {
        return i + 2
      }
    }
    return -1
  }
  for (let i = start + 1; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 0x30 && code <= 0x7e) {
      return i + 1
    }
    if (code < 0x20 || code > 0x2f) {
      return start + 2
    }
  }
  return -1
}

export function stripLeadingCursorOps (str) {
  let index = 0
  let safePrefix = ''
  while (index < str.length) {
    if (str[index] === '\r') {
      index += 1
      continue
    }
    if (str[index] !== ESC) {
      break
    }
    const end = ansiSequenceEnd(str, index)
    if (end < 0) {
      break
    }
    const type = str[index + 1]
    const final = str[end - 1]
    const isCursorOp = type === '['
      ? CURSOR_CSI_FINALS.has(final)
      : CURSOR_ESC_FINALS.has(type)
    if (!isCursorOp) {
      safePrefix += str.slice(index, end)
    }
    index = end
  }
  return safePrefix + str.slice(index)
}

function startAfterPartialAnsi (str, start) {
  if (start <= 0) {
    return start
  }
  const esc = str.lastIndexOf(ESC, start - 1)
  const newline = str.lastIndexOf('\n', start - 1)
  if (esc <= newline) {
    return start
  }
  const end = ansiSequenceEnd(str, esc)
  return end < 0 || end > start ? Math.max(start, end < 0 ? str.length : end) : start
}

function truncationMarker (dropped) {
  const kb = Math.round(dropped / 1024)
  return `\r\n...[electerm] output truncated, ${kb}K skipped...\r\n`
}

export function truncateTerminalOutput (str, maxChars) {
  if (str.length <= maxChars) {
    return { output: str, dropped: 0 }
  }
  if (maxChars < truncationMarker(str.length).length) {
    return { output: '', dropped: str.length }
  }
  let marker = truncationMarker(str.length - maxChars)
  let output = ''
  let dropped = str.length
  for (let i = 0; i < 3; i++) {
    const payloadBudget = Math.max(0, maxChars - marker.length)
    let start = Math.max(0, str.length - payloadBudget)
    const newline = str.indexOf('\n', start)
    if (newline >= 0 && newline < str.length - 1) {
      start = newline + 1
    } else {
      start = startAfterPartialAnsi(str, start)
      if (start > 0 && str.charCodeAt(start) >= 0xdc00 && str.charCodeAt(start) <= 0xdfff) {
        start += 1
      }
    }
    output = stripLeadingCursorOps(str.slice(start))
    dropped = str.length - output.length
    const nextMarker = truncationMarker(dropped)
    if (nextMarker === marker && marker.length + output.length <= maxChars) {
      break
    }
    marker = nextMarker
  }
  if (marker.length + output.length > maxChars) {
    output = output.slice(marker.length + output.length - maxChars)
    dropped = str.length - output.length
    marker = truncationMarker(dropped)
  }
  return {
    output: (marker + output).slice(0, maxChars),
    dropped
  }
}

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
    this._bufferChars = 0
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
    // Soft cap on buffered-but-unflushed characters (UTF-16 code units, not
    // bytes — see _enqueueWrite). Under a sustained flood the producer outruns
    // the renderer; once pending output exceeds this we drop the OLDEST data
    // (preserving the newest, visible tail and the line currently being
    // rewritten). Normal interactive output is many orders of magnitude
    // smaller and is never dropped.
    //
    // 2M, up from 256K: TUI apps (claude, codex, ...) repaint by rewinding
    // with ESC[nA, and Ink-style rewinds reach 50+ rows. At 256K the cap was
    // tripped routinely by ordinary TUI output, and dropping out of the middle
    // of such a stream corrupted the screen — surviving frames still carried
    // rewinds that then pointed at output we never wrote (see
    // _dropOldestUntil, which now strips them). 2M is ~200 full-screen
    // repaints of a 200x50 terminal, so only genuinely runaway output (yes,
    // `cat` of a huge file) trips it.
    this._maxBufferChars = 2 * 1024 * 1024
    this._droppedChars = 0
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

  // Index of the first OSC 633 sequence in the chunk, or -1.
  indexOfShellIntegration = (str) => {
    const ESC = String.fromCharCode(27)
    return str.indexOf(ESC + ']633;')
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
      const oscIdx = this.indexOfShellIntegration(str)
      if (oscIdx !== -1) {
        // Shell integration is confirmed active. The pty often coalesces the
        // tail of the echoed injection command and the first OSC 633 output
        // into one chunk, so write only from the first OSC sequence on —
        // everything before it is echo and stays hidden. A leading newline
        // keeps the fresh prompt off the injection-time prompt line.
        this.stopOutputSuppression(true)
        this._enqueueWrite('\r\n' + str.slice(oscIdx))
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
    this._bufferChars += str.length
    if (this._bufferChars > this._maxBufferChars) {
      this._dropOldestUntil()
    }
    // A hidden window gets its timers throttled by Chromium (Electron's
    // backgroundThrottling defaults to true), which would stall the flush
    // timer and force the cap to drop real output. Nothing is painted
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
  //
  // Dropping is lossy but must never corrupt the stream. The discarded tail
  // usually ended mid-repaint, so a surviving frame can still open with a
  // rewind (ESC[nA) or a cursor restore (ESC[8) aimed at output we never
  // wrote — left in, those yank the cursor back over already-rendered history
  // and overwrite it, which is far worse than the dropped data. Stripping them
  // (see stripLeadingCursorOps) degrades output to appending from wherever the
  // cursor actually is.
  _dropOldestUntil = () => {
    const buffered = this._writeBuffer.join('')
    if (buffered.length <= this._maxBufferChars) {
      return
    }
    const { output, dropped } = truncateTerminalOutput(buffered, this._maxBufferChars)
    this._writeBuffer = [output]
    this._bufferChars = output.length
    this._droppedChars += dropped
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
      this._bufferChars = 0
      return
    }
    this._writeBuffer = []
    this._bufferChars = 0
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
    this._bufferChars = 0
    // Reset the streaming decoder so any partial multi-byte sequence held
    // over from this connection can not leak into a reused instance.
    this.decoder = new TextDecoder('utf-8')
    this.term = null
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}
