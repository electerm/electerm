/**
 * Zmodem protocol handler for server-side terminal sessions
 * Uses zmodem2 (pure JS) for protocol implementation
 *
 * Design notes:
 * - Detection: zmodem headers (** ZDLE B ...) are detected on a small
 *   carry-over buffer so a header split across pty read chunks is still
 *   found. `detect()` returns the data unconsumed when no session is
 *   active, so normal terminal output is never swallowed.
 * - ZSKIP (remote refuses a file, e.g. rz aborted on name clash): the
 *   hex frame is scanned on the same carry buffer. On skip we abort the
 *   whole batch with the canonical cancel sequence (rz does not offer a
 *   reliable "next file" path when its UI already exited) and let the
 *   trailing garbage drain to the terminal - that is the shell/rz error
 *   output the user needs to see.
 * - Watchdog: every state transition (awaiting save path / file dialog,
 *   awaiting protocol reply, mid-transfer) arms a timer. A stalled
 *   session always ends itself instead of hanging forever with the
 *   terminal frozen.
 * - All cleanup goes through `_cleanup()`. `endSession()` is the single
 *   public reset path so `isActive()` always returns false after any
 *   failure, which is what restores normal terminal display.
 */

const fs = require('fs')
const path = require('path')
const log = require('../common/log')
const generate = require('../common/uid')
const sanitizeFilename = require('../common/sanitize-filename')

// Import zmodem2 (pure JS, no WASM)
const { Sender, Receiver, SenderEvent, ReceiverEvent } = require('zmodem2')

// Zmodem state constants
const ZMODEM_STATE = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SENDING: 'sending',
  WAITING_SAVE_PATH: 'waiting_save_path',
  WAITING_FILES: 'waiting_files'
}

// Zmodem header signature: ** + ZDLE(0x18) + B(0x42)
const ZMODEM_HEADER = Buffer.from([0x2a, 0x2a, 0x18, 0x42])

// ZRQINIT = "00" (remote wants to send -> we receive)
const ZRQINIT_HEX = Buffer.from([0x30, 0x30])
// ZRINIT = "01" (remote ready to receive -> we send)
const ZRINIT_HEX = Buffer.from([0x30, 0x31])
// ZSKIP = "05" (remote refuses current file)
const ZSKIP_HEX = Buffer.from([0x30, 0x35])

// Cancel sequence per ZMODEM spec: 8x CAN (0x18) then "B". Some peers
// only react to the 5-CAN form, 8 covers both.
const CANCEL_SEQUENCE = Buffer.from([0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x42])

// How long a header fragment is kept while waiting for the rest of it
// to arrive before we give up sniffing and pass data through.
const SNIFF_WINDOW_MS = 3000

// Watchdog timeouts (ms)
const WATCHDOG = {
  // waiting for user to pick save folder / files
  USER_ACTION: 10 * 60 * 1000,
  // waiting for protocol reply (ZRINIT after ZRQINIT etc.)
  HANDSHAKE: 30 * 1000,
  // mid-transfer silence
  TRANSFER: 60 * 1000
}

// Max bytes buffered while sniffing for a split header or waiting for
// user action. Anything beyond this is treated as a dead/aborted peer.
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024

// A peer aborted mid-transfer (user hit Ctrl-C on the remote rz/sz)
// announces it with a run of CAN (0x18) bytes. 4+ in a row can never
// appear in payload data on the wire: every literal 0x18 inside file
// data is ZDLE-escaped, so a raw run is always intentional.
const MIN_CAN_RUN = 4

// After a session ends (completion, cancel, or remote abort) the dying
// peer keeps emitting protocol debris for a moment — pty buffer flushes
// can hold several KB of in-flight frames. During this window output is
// swallowed until the shell prompt reappears (or the window expires, so
// display always recovers).
const NOISE_SUPPRESS_MS = 3000

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
    this.uploadFd = null // File descriptor for upload read
    this.uploadPath = null
    this.transferSize = 0
    this.transferredBytes = 0
    this.startTime = 0
    this.lastProgressUpdate = 0
    this.savePath = null
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.fileReadPosition = 0
    this.currentMtime = 0

    // Carry buffer: holds data that might contain the beginning of a
    // zmodem header split across chunks, and all data buffered while
    // waiting for user action (save path / file selection).
    this.carry = null
    this.scanTail = null
    this.canTail = null
    this.carrySince = 0

    this.watchdogTimer = null
    this.destroyed = false
    this._drainTimer = null

    // Set while the dying peer's trailing garbage is still expected on
    // the wire; see NOISE_SUPPRESS_MS.
    this.suppressNoiseUntil = 0
    this.residueTail = null
  }

  // ── watchdog ────────────────────────────────────────────────

  /**
   * (Re)arm the watchdog timer
   * @param {number} ms - Timeout in ms
   */
  armWatchdog (ms) {
    this.disarmWatchdog()
    if (this.destroyed || !ms) return
    this.watchdogTimer = setTimeout(() => {
      if (this.state === ZMODEM_STATE.IDLE) return
      log.warn(`zmodem watchdog timeout in state ${this.state}, ending session`)
      this.sendToClient({
        event: 'session-timeout',
        message: 'ZMODEM session timed out'
      })
      this.abort(true)
    }, ms)
    // Do not keep the event loop alive just for the watchdog
    if (this.watchdogTimer.unref) this.watchdogTimer.unref()
  }

  disarmWatchdog () {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  // ── client / terminal io ────────────────────────────────────

  /**
   * Send message to client via websocket
   * @param {Object} msg - Message to send
   */
  sendToClient (msg) {
    if (this.ws && this.ws.s && !this.destroyed) {
      this.ws.s({
        action: 'zmodem-event',
        ...msg
      })
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

  // ── detection ───────────────────────────────────────────────

  /**
   * Scan a buffer for a zmodem start/skip header starting at or after `from`
   * @param {Buffer} data
   * @param {number} from
   * @returns {Object|null} { kind: 'receive'|'send'|'skip', offset: number }
   */
  scanBuffer (data, from = 0) {
    const end = data.length - ZMODEM_HEADER.length - 1
    for (let i = from; i <= end; i++) {
      if (
        data[i] === ZMODEM_HEADER[0] &&
        data[i + 1] === ZMODEM_HEADER[1] &&
        data[i + 2] === ZMODEM_HEADER[2] &&
        data[i + 3] === ZMODEM_HEADER[3]
      ) {
        const h1 = data[i + 4]
        const h2 = data[i + 5]
        if (h1 === ZRQINIT_HEX[0] && h2 === ZRQINIT_HEX[1]) {
          return { kind: 'receive', offset: i }
        }
        if (h1 === ZRINIT_HEX[0] && h2 === ZRINIT_HEX[1]) {
          return { kind: 'send', offset: i }
        }
        if (h1 === ZSKIP_HEX[0] && h2 === ZSKIP_HEX[1]) {
          return { kind: 'skip', offset: i }
        }
      }
    }
    return null
  }

  /**
   * Check whether the tail of `data` could be the beginning of a header
   * that continues in the next chunk (e.g. "*\x18B0" waiting for its
   * final type nibble). Returns the partial length, or 0.
   * @param {Buffer} data
   * @returns {number}
   */
  partialHeaderLength (data) {
    const max = Math.min(data.length, ZMODEM_HEADER.length + 1)
    for (let len = max; len > 0; len--) {
      let ok = true
      for (let j = 0; j < len; j++) {
        if (data[data.length - len + j] !== ZMODEM_HEADER[j]) {
          ok = false
          break
        }
      }
      if (ok) return len
    }
    return 0
  }

  /**
   * Find a raw run of CAN (0x18) bytes, the peer's abort signal.
   * Scans across chunk boundaries via its own tail buffer (independent
   * of the ZSKIP scanTail). Escaped 0x18 in file data always arrives as
   * ZDLE-escaped pairs, so a raw MIN_CAN_RUN run is unambiguous.
   * @param {Buffer} data
   * @returns {boolean}
   */
  hasCanRun (data) {
    const hay = this.canTail ? Buffer.concat([this.canTail, data]) : data
    this.canTail = Buffer.from(hay.subarray(Math.max(0, hay.length - (MIN_CAN_RUN - 1))))
    let run = 0
    for (const b of hay) {
      if (b === 0x18) {
        run++
        if (run >= MIN_CAN_RUN) return true
      } else {
        run = 0
      }
    }
    return false
  }

  // ── data entry point ────────────────────────────────────────

  /**
   * Handle incoming data from terminal
   * @param {Buffer} data - Incoming data
   * @returns {boolean} - True if data was consumed by zmodem
   */
  /**
   * Observe user keystrokes on their way to the pty (called by the
   * session-server before writing terminal input). A Ctrl-C (ETX)
   * while a transfer is running means the remote rz/sz is about to be
   * killed by SIGINT: end the session right away so (a) we stop
   * feeding protocol frames into the shell that takes over the pty
   * (they would be echoed back as garbage text) and (b) terminal
   * output resumes immediately instead of after the watchdog timeout.
   * The keystroke itself is never swallowed - normal shell behavior is
   * untouched.
   * @param {string|Buffer} data - User input about to reach the pty
   */
  handleUserInput (data) {
    if (this.destroyed || this.state === ZMODEM_STATE.IDLE) return
    if (typeof data === 'string' ? !data.includes('\x03') : !data.includes(3)) return
    log.debug('zmodem: user pressed Ctrl-C during transfer, ending session')
    this.sendToClient({
      event: 'transfer-error',
      message: 'Transfer interrupted (Ctrl-C)'
    })
    // No cancel sequence: the remote program is dying / dead already;
    // writing ours would just be echoed by the shell as garbage.
    this.abort(false)
  }

  handleData (data) {
    if (this.destroyed) return false
    if (!Buffer.isBuffer(data)) data = Buffer.from(data)

    switch (this.state) {
      case ZMODEM_STATE.IDLE:
        return this.handleIdleData(data)

      case ZMODEM_STATE.WAITING_SAVE_PATH:
      case ZMODEM_STATE.WAITING_FILES:
        this.bufferPending(data)
        return true

      case ZMODEM_STATE.RECEIVING:
        // A raw CAN run means the remote rz was killed (Ctrl-C). The
        // state machine would ignore those bytes and stall until the
        // watchdog, so detect and end immediately - silently: writing
        // our own cancel sequence back would only echo more garbage
        // from the shell that now owns the pty.
        if (this.hasCanRun(data)) {
          log.debug('zmodem: remote sent CAN run, session aborted by peer')
          this.sendToClient({
            event: 'transfer-error',
            message: 'Transfer aborted by remote side'
          })
          this.abort(false)
          return true
        }
        this.armWatchdog(WATCHDOG.TRANSFER)
        this.handleReceiverData(data)
        return true

      case ZMODEM_STATE.SENDING:
        if (this.hasCanRun(data)) {
          log.debug('zmodem: remote sent CAN run, session aborted by peer')
          this.sendToClient({
            event: 'transfer-error',
            message: 'Transfer aborted by remote side'
          })
          this.abort(false)
          return true
        }
        this.armWatchdog(WATCHDOG.TRANSFER)
        this.handleSenderData(data)
        return true

      default:
        return false
    }
  }

  /**
   * State: idle. Look for the start of a session.
   *
   * Contract with session-server: returning false means "not zmodem,
   * send the chunk to the client yourself"; returning true means "mine,
   * already forwarded anything displayable via ws". While sniffing a
   * split header we own the output so nothing is double-sent.
   * @returns {boolean}
   */
  handleIdleData (data) {
    // Post-session noise suppression. After a transfer dies mid-flight
    // (user Ctrl-C etc.) the kernel pty buffers flush up to several KB
    // of in-flight protocol data, and the shell echoes back frames it
    // swallowed as input — screens worth of garbage. Printable-ness is
    // NOT a usable filter here (file payloads and hex frames are pure
    // printable text), so during the window we swallow EVERYTHING and
    // only resume display once the shell prompt reappears: a short
    // printable line ending in a prompt char ($ # > %). The window has
    // a hard cap so display always recovers even if no prompt is ever
    // detected (plain sh, unusual PS1).
    if (Date.now() < this.suppressNoiseUntil) {
      // Match against remembered tail + new data so a prompt split
      // across chunks is still recognized
      const hay = this.residueTail
        ? this.residueTail + data.toString('utf8')
        : data.toString('utf8')
      // A prompt: a fresh line (or chunk start) of short printable
      // text ending in a prompt char ($ # > %) right at the end.
      const m = hay.match(/(?:^|[\r\n])([^\r\n]{1,80})[\x20\t]*$/)
      const promptish = m !== null && /[\x24#>%»]\s?$/.test(m[1])
      if (promptish) {
        // prompt reappeared: show just the prompt line, close the window
        this.passThroughPrefix(Buffer.from(m[0], 'utf8'))
        this.suppressNoiseUntil = 0
        this.residueTail = null
        return true
      }
      if (!this.looksLikeNoise(data)) {
        // keep a printable tail for the cross-chunk match above
        const keep = Math.min(hay.length, 160)
        this.residueTail = hay.slice(hay.length - keep)
      } else {
        this.residueTail = null
      }
      // Debris still flowing past the window cap: keep swallowing
      // (extend) — a large pty-buffer flush can outlast one window.
      if (Date.now() + 50 >= this.suppressNoiseUntil) {
        this.suppressNoiseUntil = Date.now() + NOISE_SUPPRESS_MS
      }
      return true
    }
    this.residueTail = null

    // Expire a stale header fragment that never completed
    if (this.carry && Date.now() - this.carrySince > SNIFF_WINDOW_MS) {
      this.passThroughPrefix(this.carry)
      this.carry = null
    }

    // Search carry + data so a header split across chunks is found.
    const hay = this.carry ? Buffer.concat([this.carry, data]) : data
    this.carry = null

    const hit = this.scanBuffer(hay, 0)
    if (hit) {
      if (hit.kind === 'skip') {
        // ZSKIP with no session in flight is stray noise - drop it
        return true
      }
      // Output before the header (e.g. "rz waiting to receive.\r\n")
      // stays visible
      this.passThroughPrefix(hay.subarray(0, hit.offset))
      this.startSessionFromHit(hit.kind, hay.subarray(hit.offset))
      return true
    }

    // No full header. If the chunk tail could be the start of one,
    // hold it back and enter sniff mode (we consume + forward output
    // ourselves until the question resolves).
    const partial = this.partialHeaderLength(hay)
    if (partial > 0) {
      this.passThroughPrefix(hay.subarray(0, hay.length - partial))
      this.carry = Buffer.from(hay.subarray(hay.length - partial))
      this.carrySince = Date.now()
      return true
    }

    // Plain terminal output - let session-server forward the chunk
    return false
  }

  /**
   * Emit pre-header terminal output back to the client. Called via the
   * same ws path the session-server would have used.
   * @param {Buffer} prefix
   */
  passThroughPrefix (prefix) {
    if (!prefix || !prefix.length || !this.ws || !this.ws.send) return
    // Only forward readable output; drop protocol noise that would
    // corrupt the display.
    if (this.looksLikeNoise(prefix)) return
    try {
      this.ws.send(prefix)
    } catch (e) {
      // ws closed - nothing to do
    }
  }

  /**
   * Heuristic: buffers that are mostly control bytes / non-printable
   * are zmodem line noise, not something to display.
   * @param {Buffer} buf
   * @returns {boolean}
   */
  looksLikeNoise (buf) {
    if (!buf.length) return true
    let printable = 0
    for (const b of buf) {
      // CR LF TAB ESC BEL BS and visible ASCII count as displayable
      if (b === 0x0d || b === 0x0a || b === 0x09 || b === 0x1b || b === 0x07 || b === 0x08 || (b >= 0x20 && b !== 0x7f)) printable++
    }
    return printable / buf.length < 0.5
  }

  /**
   * Begin a receiver or sender session based on detected frame kind
   * @param {string} kind - 'receive' | 'send' | 'skip'
   * @param {Buffer} rest - Data from the header onwards
   */
  startSessionFromHit (kind, rest) {
    if (kind === 'receive') {
      this.startReceiver(rest)
    } else if (kind === 'send') {
      this.startSender(rest)
    }
  }

  /**
   * Buffer data while waiting for user action, with sanity limits
   * @param {Buffer} data
   */
  bufferPending (data) {
    this.carry = this.carry ? Buffer.concat([this.carry, data]) : Buffer.from(data)
    if (!this.carrySince) this.carrySince = Date.now()
    if (this.carry.length > MAX_BUFFERED_BYTES) {
      log.warn('zmodem: peer flooded the session while waiting for user action, aborting')
      this.abort(true)
    }
  }

  // ── receive (download) ──────────────────────────────────────

  /**
   * Start a receive session (remote is sending file(s))
   * @param {Buffer} initialData - Initial zmodem data
   */
  startReceiver (initialData) {
    try {
      this.receiver = new Receiver()
      this.transferredBytes = 0
      this.currentMtime = 0
      this.carry = initialData && initialData.length
        ? Buffer.from(initialData)
        : null
      this.carrySince = Date.now()
      this.state = ZMODEM_STATE.WAITING_SAVE_PATH

      this.sendToClient({
        event: 'receive-start',
        message: 'ZMODEM receive session started'
      })
      this.armWatchdog(WATCHDOG.USER_ACTION)
    } catch (e) {
      log.error('Failed to start zmodem receiver', e)
      this.abort(true)
    }
  }

  /**
   * Set save path for receiving files, then replay buffered wire data
   * @param {string} savePath - Directory path to save files
   */
  setSavePath (savePath) {
    if (this.state !== ZMODEM_STATE.WAITING_SAVE_PATH) return
    this.savePath = savePath
    this.state = ZMODEM_STATE.RECEIVING
    this.armWatchdog(WATCHDOG.TRANSFER)

    const pending = this.carry || Buffer.alloc(0)
    this.carry = null
    if (pending.length) {
      this.handleReceiverData(pending)
    }
  }

  /**
   * Feed wire data to the receiver state machine and pump outputs
   * @param {Buffer} data
   */
  handleReceiverData (data) {
    if (!this.receiver) return
    const u8 = Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(Buffer.from(data))
    let offset = 0
    let iterations = 0

    while (offset < u8.length && iterations++ < 1000 && this.receiver) {
      try {
        const consumed = this.receiver.feedIncoming(u8.subarray(offset))
        offset += consumed
        const drained = this.pumpReceiver()
        if (consumed === 0 && !drained) break
      } catch (e) {
        log.error('Zmodem receiver error:', e)
        this.sendToClient({
          event: 'transfer-error',
          message: 'ZMODEM protocol error during receive'
        })
        this.abort(true)
        return
      }
    }
  }

  /**
   * Drain receiver outputs: wire replies, events, file data
   * @returns {boolean} - True if work was done
   */
  pumpReceiver () {
    if (!this.receiver) return false
    let didWork = false

    try {
      // Order matters: drain file data FIRST. finishSubpacket (triggered
      // by drainFile/advanceFile) queues ZACK replies; draining outgoing
      // last flushes them in the same pump. With the opposite order a
      // trailing ZACK stays queued when input runs out, and the peer
      // stalls forever waiting for its ack.
      const chunk = this.receiver.drainFile()
      if (chunk && chunk.length > 0) {
        this.handleFileData(Buffer.from(chunk))
        this.receiver.advanceFile(chunk.length)
        didWork = true
      }

      let event
      while ((event = this.receiver.pollEvent()) !== null) {
        didWork = true
        if (event === ReceiverEvent.FileStart) {
          this.handleFileStart(
            this.receiver.getFileName(),
            this.receiver.getFileSize(),
            this.receiver.getFileMtime()
          )
        } else if (event === ReceiverEvent.FileComplete) {
          this.handleFileComplete()
        } else if (event === ReceiverEvent.SessionComplete) {
          // Drain the queued ZFIN ack BEFORE resetting: the remote
          // waits for it to leave state 6 and print its exit message.
          const finalReply = this.receiver.drainOutgoing()
          if (finalReply && finalReply.length > 0) {
            this.writeToTerminal(Buffer.from(finalReply))
          }
          this.endSession(true)
          return true
        }
      }

      const outgoing = this.receiver.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
        didWork = true
      }
    } catch (e) {
      log.error('Zmodem receiver pump error:', e)
      this.abort(true)
      return false
    }
    return didWork
  }

  /**
   * Handle file start event
   */
  handleFileStart (name, size, mtime) {
    this.currentTransfer = { name, size }
    this.transferSize = size
    this.transferredBytes = 0
    this.currentMtime = mtime || 0
    this.lastProgressUpdate = 0
    this.prepareReceiveFile(name, size)
    this.sendToClient({ event: 'file-start', name, size })
  }

  /**
   * Create the output file write stream
   * @param {string} name
   * @param {number} size
   */
  prepareReceiveFile (name, size) {
    try {
      let filePath = path.join(this.savePath, sanitizeFilename(name))

      // Avoid clobbering an existing file
      if (fs.existsSync(filePath)) {
        filePath = `${filePath}.${generate()}`
      }

      this.downloadPath = filePath
      const stream = fs.createWriteStream(filePath, {
        highWaterMark: 64 * 1024
      })
      // A failed write (disk full, permission) must end the session
      // instead of leaking a broken stream.
      stream.on('error', (e) => {
        log.error('zmodem download stream error', e)
        this.sendToClient({
          event: 'transfer-error',
          message: `Failed to write ${filePath}: ${e.message}`
        })
        this.downloadStream = null
        this.abort(true)
      })
      this.downloadStream = stream

      this.sendToClient({
        event: 'file-prepared',
        name,
        path: filePath,
        size
      })
    } catch (e) {
      log.error('Failed to prepare receive file', e)
      this.abort(true)
    }
  }

  /**
   * Handle file data chunk
   * @param {Buffer} data
   */
  handleFileData (data) {
    if (!this.downloadStream || !this.currentTransfer) return

    if (this.transferredBytes === 0) {
      this.startTime = Date.now()
    }

    this.downloadStream.write(data)
    this.transferredBytes += data.length

    const now = Date.now()
    if (now - this.lastProgressUpdate > 500) {
      this.lastProgressUpdate = now
      this.sendProgress()
    }
  }

  /**
   * Handle file complete event
   */
  handleFileComplete () {
    const filePath = this.downloadPath
    const fileMtime = this.currentMtime
    const currentTransfer = this.currentTransfer

    // Notify the client immediately: the protocol has all bytes, and the
    // ZFIN handshake (session-end) often wins the race against the
    // stream's async finish event, which would otherwise report the
    // transfer complete only after the session already closed.
    this.sendToClient({
      event: 'file-complete',
      name: currentTransfer?.name,
      path: filePath
    })
    this.currentTransfer = null
    this.downloadPath = null
    this.currentMtime = 0

    const finalize = () => {
      if (filePath && fileMtime > 0) {
        try {
          const mtimeDate = new Date(fileMtime)
          fs.utimesSync(filePath, mtimeDate, mtimeDate)
        } catch (e) {
          log.error('Failed to set file modification time', e)
        }
      }
    }

    if (this.downloadStream) {
      const stream = this.downloadStream
      this.downloadStream = null
      stream.on('finish', finalize)
      stream.on('error', () => {}) // error path already handled above
      stream.end()
    } else {
      finalize()
    }
  }

  // ── send (upload) ───────────────────────────────────────────

  /**
   * Start a send session (remote is ready to receive file(s))
   * @param {Buffer} initialData - Initial zmodem data (contains ZRINIT)
   */
  startSender (initialData) {
    try {
      this.state = ZMODEM_STATE.WAITING_FILES
      // Non-initiator: remote sent ZRINIT first
      this.sender = new Sender(false)
      this.carry = initialData && initialData.length
        ? Buffer.from(initialData)
        : null
      this.carrySince = Date.now()

      this.sendToClient({
        event: 'send-start',
        message: 'ZMODEM send session started, please select files'
      })
      this.armWatchdog(WATCHDOG.USER_ACTION)
    } catch (e) {
      log.error('Failed to start zmodem sender', e)
      this.abort(true)
    }
  }

  /**
   * Feed wire data to the sender state machine and pump outputs.
   * Also watches for ZSKIP (remote refuses the current file).
   * @param {Buffer} data
   */
  handleSenderData (data) {
    if (!this.sender) return
    const u8 = Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(Buffer.from(data))

    // ZSKIP scan: the zmodem2 Sender ignores unknown frames, so without
    // this a "rz: file exists" abort would hang forever. Scan across
    // chunk boundaries by prepending the tail of the previous chunk.
    const hay = this.scanTail ? Buffer.concat([this.scanTail, data]) : data
    this.scanTail = Buffer.from(hay.subarray(Math.max(0, hay.length - (ZMODEM_HEADER.length + 1))))
    const skip = this.scanBuffer(hay, 0)
    if (skip && skip.kind === 'skip') {
      log.debug('zmodem: ZSKIP received, remote refused file')
      this.handleFileSkipped()
      return
    }

    let offset = 0
    let iterations = 0
    while (offset < u8.length && iterations++ < 1000 && this.sender) {
      try {
        const consumed = this.sender.feedIncoming(u8.subarray(offset))
        offset += consumed
        const drained = this.pumpSender()
        if (consumed === 0 && !drained) break
      } catch (e) {
        log.error('Zmodem sender error:', e)
        this.sendToClient({
          event: 'transfer-error',
          message: 'ZMODEM protocol error during send'
        })
        this.abort(true)
        return
      }
    }
  }

  /**
   * Handle ZSKIP: remote refused the file. rz has usually exited by
   * now, so abort the batch cleanly and let trailing output drain.
   */
  handleFileSkipped () {
    this.sendToClient({
      event: 'file-skipped',
      name: this.currentTransfer?.name,
      message: 'Skipped by remote side (file exists or refused)'
    })

    // Notify the remote we are done, then tear down. Subsequent pty
    // output (shell prompt / rz error text) goes back to the terminal
    // because isActive() is false again.
    this.writeToTerminal(CANCEL_SEQUENCE)
    this.abort(false)
  }

  /**
   * Drain sender outputs: wire data, events, file read requests
   * @returns {boolean}
   */
  pumpSender () {
    if (!this.sender) return false
    let didWork = false

    try {
      const outgoing = this.sender.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
        didWork = true
      }

      let event
      while ((event = this.sender.pollEvent()) !== null) {
        didWork = true
        if (event === SenderEvent.FileComplete) {
          this.handleSendFileComplete()
        } else if (event === SenderEvent.SessionComplete) {
          this.endSession(true)
          return true
        }
      }

      const request = this.sender.pollFile()
      if (request !== null) {
        this.sendFileData(request.offset, request.len)
        didWork = true
      }
    } catch (e) {
      log.error('Zmodem sender pump error', e)
      this.abort(true)
      return false
    }

    return didWork
  }

  /**
   * Read file data at offset and feed it to the sender
   * @param {number} offset - File offset
   * @param {number} length - Data length to read
   */
  sendFileData (offset, length) {
    if (!this.currentTransfer || !this.sender || !this.uploadPath) return

    try {
      const CHUNK_SIZE = 64 * 1024
      const readLen = Math.min(length, CHUNK_SIZE)
      const data = Buffer.allocUnsafe(readLen)

      if (this.uploadFd === null || this.uploadFd === undefined) {
        this.uploadFd = fs.openSync(this.uploadPath, 'r')
        this.fileReadPosition = 0
      }

      const bytesRead = readLen > 0 ? fs.readSync(this.uploadFd, data, 0, readLen, offset) : 0
      this.fileReadPosition = offset + bytesRead
      const actualData = data.subarray(0, bytesRead)

      if (bytesRead > 0) {
        if (this.transferredBytes === 0) {
          this.startTime = Date.now()
        }
        this.sender.feedFile(new Uint8Array(actualData))
        this.transferredBytes = offset + bytesRead

        const now = Date.now()
        if (now - this.lastProgressUpdate > 500) {
          this.lastProgressUpdate = now
          this.sendProgress()
        }

        const outgoing = this.sender.drainOutgoing()
        if (outgoing && outgoing.length > 0) {
          this.writeToTerminal(Buffer.from(outgoing))
        }
      }

      if (bytesRead === 0 || offset + bytesRead >= this.currentTransfer.size) {
        // Whole file fed. The state machine completes on ZEOF/ZRINIT;
        // finishSession() is only for "no more files" (finishSender).
        if (this.uploadFd !== null && this.uploadFd !== undefined) {
          fs.closeSync(this.uploadFd)
          this.uploadFd = null
        }
      }
    } catch (e) {
      log.error('Failed to read file data for sending', e)
      this.sendToClient({
        event: 'transfer-error',
        message: `Failed to read ${this.uploadPath}: ${e.message}`
      })
      this.abort(true)
    }
  }

  /**
   * Handle send file complete event
   */
  handleSendFileComplete () {
    if (this.currentTransfer) {
      this.transferredBytes = this.transferSize
      this.sendProgress()
    }

    this.sendToClient({
      event: 'file-complete',
      name: this.currentTransfer?.name,
      path: this.uploadPath
    })

    this.currentFileIndex++
    if (this.pendingFiles.length > this.currentFileIndex) {
      this.sendFile(this.pendingFiles[this.currentFileIndex])
    } else {
      this.finishSender()
    }
  }

  /**
   * Begin sending one file
   * @param {Object} file - File info { path, name, size }
   */
  sendFile (file) {
    if (!this.sender) return

    try {
      this.currentTransfer = { name: file.name, size: file.size }
      this.transferSize = file.size
      this.transferredBytes = 0
      this.uploadPath = file.path
      this.fileReadPosition = 0
      this.lastProgressUpdate = 0

      if (this.uploadFd !== null && this.uploadFd !== undefined) {
        fs.closeSync(this.uploadFd)
        this.uploadFd = null
      }

      // mtime in ms so the remote side preserves modification time
      this.sender.startFile(file.name, file.size, file.modifyTime || 0)

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
      this.abort(true)
    }
  }

  /**
   * Finish sender session after the last file
   */
  finishSender () {
    if (!this.sender) return

    try {
      this.sender.finishSession()
      const outgoing = this.sender.drainOutgoing()
      if (outgoing && outgoing.length > 0) {
        this.writeToTerminal(Buffer.from(outgoing))
      }
      this.armWatchdog(WATCHDOG.HANDSHAKE)
    } catch (e) {
      log.error('Failed to finish zmodem sender session', e)
      this.abort(true)
    }
  }

  /**
   * Set files to send and kick off the first transfer
   * @param {Array} files - Array of file info objects
   */
  setSendFiles (files) {
    if (this.state !== ZMODEM_STATE.WAITING_FILES) return
    this.pendingFiles = Array.isArray(files) ? files : []
    this.currentFileIndex = 0
    this.state = ZMODEM_STATE.SENDING
    this.armWatchdog(WATCHDOG.TRANSFER)

    // Replay the buffered wire data (initial ZRINIT etc.) so the sender
    // state machine can transition before we start the first file.
    const pending = this.carry || Buffer.alloc(0)
    this.carry = null
    if (pending.length) {
      this.handleSenderData(pending)
    }

    if (this.pendingFiles.length > 0) {
      this.sendFile(this.pendingFiles[0])
    } else {
      this.finishSender()
    }
  }

  // ── progress ────────────────────────────────────────────────

  /**
   * Send progress update to client
   */
  sendProgress () {
    const elapsed = (Date.now() - this.startTime) / 1000
    const speed = elapsed > 0 ? Math.round(this.transferredBytes / elapsed) : 0
    const percent = this.transferSize > 0
      ? Math.min(100, Math.floor(this.transferredBytes * 100 / this.transferSize))
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

  // ── teardown ────────────────────────────────────────────────

  /**
   * Abort an ongoing transfer: tell the remote, clean up, notify client.
   * @param {boolean} sendCancel - Write the cancel sequence to the pty
   */
  abort (sendCancel) {
    if (sendCancel) {
      this.writeToTerminal(CANCEL_SEQUENCE)
    }
    this.endSession()
  }

  /**
   * End zmodem session and release every resource. Safe to call twice.
   * @param {boolean} clean - True when the protocol closed properly
   *   (ZFIN handshake): no debris is expected, so the noise-suppression
   *   window is NOT armed and shell output flows immediately. Abnormal
   *   ends arm the window to swallow the dying peer's garbage.
   */
  endSession (clean = false) {
    if (this.downloadStream) {
      const stream = this.downloadStream
      this.downloadStream = null
      stream.destroy()
      try { stream.end() } catch (e) { /* already destroyed */ }
    }

    if (this.uploadFd !== null && this.uploadFd !== undefined) {
      try {
        fs.closeSync(this.uploadFd)
      } catch (e) {
        log.error('Error closing upload file', e)
      }
      this.uploadFd = null
    }

    this.disarmWatchdog()

    // Only an aborted transfer leaves debris on the wire. A clean ZFIN
    // close arms nothing, so post-transfer shell output shows instantly.
    if (!clean) {
      this.suppressNoiseUntil = Date.now() + NOISE_SUPPRESS_MS
    }

    this.sendToClient({ event: 'session-end' })

    this.state = ZMODEM_STATE.IDLE
    this.receiver = null
    this.sender = null
    this.currentTransfer = null
    this.currentMtime = 0
    this.downloadPath = null
    this.uploadPath = null
    this.pendingFiles = []
    this.currentFileIndex = 0
    this.savePath = null
    this.fileReadPosition = 0
    this.transferredBytes = 0
    this.transferSize = 0
    this.carry = null
    this.scanTail = null
    this.canTail = null
    this.carrySince = 0
    this.lastProgressUpdate = 0
    this.residueTail = null
    // keep suppressNoiseUntil: it was just armed above
  }

  /**
   * User-initiated cancel
   */
  cancel () {
    this.abort(true)
  }

  /**
   * Check if session is active
   * @returns {boolean}
   */
  isActive () {
    return this.state !== ZMODEM_STATE.IDLE && !this.destroyed
  }

  /**
   * Final teardown when the terminal goes away
   */
  destroy () {
    if (this.destroyed) return
    this.destroyed = true
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
        // kept for backward compatibility; receive prep is automatic now
        break
    }
  }

  /**
   * Observe user keystrokes for a terminal before they reach the pty.
   * Lets an active session react to Ctrl-C immediately.
   * @param {string} pid - Terminal PID
   * @param {string|Buffer} data - User input
   */
  handleUserInput (pid, data) {
    const session = this.sessions.get(pid)
    if (session) session.handleUserInput(data)
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
  ZMODEM_HEADER,
  WATCHDOG,
  MAX_BUFFERED_BYTES
}
