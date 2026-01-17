/**
 * customize AttachAddon
 */
import { AttachAddon } from '@xterm/addon-attach'

export default class AttachAddonCustom extends AttachAddon {
  constructor (term, socket, isWindowsShell) {
    super(socket)
    this.term = term
    this.socket = socket
    this.isWindowsShell = isWindowsShell
    // Output suppression state for shell integration injection
    this.outputSuppressed = false
    this.suppressedData = []
    this.suppressTimeout = null
    this.onSuppressionEndCallback = null
    // Track if we've received initial data from the terminal
    this.hasReceivedInitialData = false
    this.onInitialDataCallback = null
  }

  /**
   * Set callback for when initial data is received
   * @param {Function} callback - Called when first data arrives
   */
  onInitialData = (callback) => {
    if (this.hasReceivedInitialData) {
      // Already received, call immediately
      callback()
    } else {
      this.onInitialDataCallback = callback
    }
  }

  /**
   * Start suppressing output - used during shell integration injection
   * @param {number} timeout - Max time to suppress in ms (safety fallback)
   * @param {Function} onEnd - Callback when suppression ends
   */
  startOutputSuppression = (timeout = 3000, onEnd = null) => {
    this.outputSuppressed = true
    this.suppressedData = []
    this.onSuppressionEndCallback = onEnd
    // Safety timeout to ensure we always resume
    this.suppressTimeout = setTimeout(() => {
      console.warn('[AttachAddon] Output suppression timeout reached, resuming')
      this.stopOutputSuppression(false)
    }, timeout)
  }

  /**
   * Stop suppressing output and optionally discard buffered data
   * @param {boolean} discard - If true, discard buffered data; if false, write it to terminal
   */
  stopOutputSuppression = (discard = true) => {
    if (this.suppressTimeout) {
      clearTimeout(this.suppressTimeout)
      this.suppressTimeout = null
    }
    this.outputSuppressed = false

    if (!discard && this.suppressedData.length > 0) {
      // Write buffered data to terminal
      for (const data of this.suppressedData) {
        this.writeToTerminalDirect(data)
      }
    }
    this.suppressedData = []

    // Call the end callback if set
    if (this.onSuppressionEndCallback) {
      const callback = this.onSuppressionEndCallback
      this.onSuppressionEndCallback = null
      callback()
    }
  }

  /**
   * Check if we should resume output based on OSC 633 detection
   * Called when shell integration is detected
   */
  onShellIntegrationDetected = () => {
    if (this.outputSuppressed) {
      this.stopOutputSuppression(true) // Discard the integration command output
    }
  }

  activate (terminal = this.term) {
    this.trzsz = window.newTrzsz(
      this.writeToTerminal,
      this.sendToServer,
      terminal.cols,
      this.isWindowsShell
    )

    this.addSocketListener(this._socket, 'message', this.onMsg)

    if (this._bidirectional) {
      this._disposables.push(terminal.onData((data) => this.trzsz.processTerminalInput(data)))
      this._disposables.push(terminal.onBinary((data) => this.trzsz.processBinaryInput(data)))
    }

    this._disposables.push(terminal.onResize((size) => this.trzsz.setTerminalColumns(size.cols)))

    this._disposables.push(this.addSocketListener(this._socket, 'close', () => this.dispose()))
    this._disposables.push(this.addSocketListener(this._socket, 'error', () => this.dispose()))
  }

  onMsg = (ev) => {
    // When in alternate screen mode (like vim, less, or TUI apps like Claude Code),
    // bypass trzsz processing to avoid interference with the application's display
    if (this.term?.buffer?.active?.type === 'alternate') {
      this.writeToTerminal(ev.data)
    } else {
      this.trzsz.processServerOutput(ev.data)
    }
  }

  /**
   * Check if data contains OSC 633 shell integration sequences
   * @param {string} str - Data string to check
   * @returns {boolean} True if OSC 633 sequence detected
   */
  checkForShellIntegration = (str) => {
    // OSC 633 sequences: ESC]633;X where X is A, B, C, D, E, or P
    // ESC is character code 27 (0x1b)
    // Use includes with the actual characters to avoid lint warning
    const ESC = String.fromCharCode(27)
    return str.includes(ESC + ']633;')
  }

  /**
   * Write directly to terminal, bypassing suppression check
   * Used for flushing buffered data
   */
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

    // Track initial data arrival
    if (!this.hasReceivedInitialData) {
      this.hasReceivedInitialData = true
      if (this.onInitialDataCallback) {
        const callback = this.onInitialDataCallback
        this.onInitialDataCallback = null
        // Call after a micro-delay to ensure this data is written first
        setTimeout(callback, 0)
      }
    }

    // Check for shell integration in the data (only when suppressing)
    if (this.outputSuppressed) {
      let str = data
      if (typeof data !== 'string') {
        // Convert to string to check for OSC 633
        const decoder = this.decoder || new TextDecoder('utf-8')
        try {
          str = decoder.decode(data instanceof ArrayBuffer ? data : new Uint8Array(data))
        } catch (e) {
          str = ''
        }
      }

      // If we detect OSC 633, shell integration is working
      if (this.checkForShellIntegration(str)) {
        this.onShellIntegrationDetected()
        // Don't buffer this - just discard the integration output
        return
      }

      // Buffer the data while suppressed
      this.suppressedData.push(data)
      return
    }

    if (typeof data === 'string') {
      return term.write(data)
    }
    data = new Uint8Array(data)
    const fileReader = new FileReader()
    fileReader.addEventListener('load', this.onRead)
    fileReader.readAsArrayBuffer(new window.Blob([data]))
  }

  onRead = (ev) => {
    const data = ev.target.result
    const { term } = this
    term?.parent?.notifyOnData()
    const str = this.decoder.decode(data)
    // CWD tracking is now handled by shell integration automatically
    // No need to parse PS1 markers
    term?.write(str)
  }

  sendToServer = (data) => {
    this._sendData(data)
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
    this.term = null
    this._disposables.forEach(d => d.dispose())
    this._disposables.length = 0
  }
}
