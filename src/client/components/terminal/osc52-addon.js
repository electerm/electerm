/**
 * Osc52Addon - Handles OSC 52 clipboard escape sequences
 *
 * OSC 52 allows terminal programs (TUI apps like vim, tmux, opencode, etc.)
 * to copy and paste text via the system clipboard.
 *
 * Format: ESC ] 52 ; Pc ; Pd BEL (or ST)
 *   Pc = clipboard selection: c (clipboard), p (primary), s (secondary)
 *   Pd = base64-encoded content, or "?" to read
 *
 * Write request: ESC ] 52 ; c ; <base64data> BEL
 *   -> decodes base64 and writes to system clipboard
 *
 * Read request: ESC ] 52 ; c ; ? BEL
 *   -> reads system clipboard, encodes base64, sends response
 */

export class Osc52Addon {
  constructor () {
    this.terminal = undefined
    this._disposables = []
    this._sendData = null
  }

  /**
   * Set the function used to send data back to the PTY
   * @param {function} sendDataFn - function(string) to send data to server
   */
  setSendData (sendDataFn) {
    this._sendData = sendDataFn
  }

  activate (terminal) {
    this.terminal = terminal

    if (terminal.parser && terminal.parser.registerOscHandler) {
      const oscHandler = terminal.parser.registerOscHandler(52, (data) => {
        return this._handleOsc52(data)
      })
      this._disposables.push(oscHandler)
    }
  }

  dispose () {
    this.terminal = null
    if (this._disposables) {
      this._disposables.forEach(d => d.dispose())
      this._disposables.length = 0
    }
  }

  /**
   * Handle OSC 52 clipboard sequence
   * @param {string} data - The OSC data after "52;"
   * @returns {boolean} Whether the sequence was handled
   */
  _handleOsc52 (data) {
    if (!data) return false

    // Parse: Pc;Pd where Pc is selection target and Pd is payload
    const semicolonIdx = data.indexOf(';')
    if (semicolonIdx === -1) return false

    const target = data.substring(0, semicolonIdx)
    const payload = data.substring(semicolonIdx + 1)

    // Only handle clipboard target ('c'), also accept 'c' among multiple targets
    if (!target.includes('c')) return false

    if (payload === '?') {
      // Read request - send clipboard content back
      return this._handleReadRequest()
    }

    // Write request - decode and write to clipboard
    return this._handleWriteRequest(payload)
  }

  /**
   * Handle clipboard read request (ESC]52;c;? BEL)
   * Reads system clipboard and sends response back to the terminal
   */
  _handleReadRequest () {
    try {
      const text = window.pre.readClipboard()
      const base64 = text ? this._encodeBase64(text) : ''
      this._sendResponse(base64)
    } catch (e) {
      console.error('OSC 52 clipboard read failed:', e)
      this._sendResponse('')
    }
    return true
  }

  /**
   * Handle clipboard write request (ESC]52;c;<base64> BEL)
   * Decodes base64 content and writes to system clipboard
   */
  _handleWriteRequest (base64Data) {
    try {
      const text = this._decodeBase64(base64Data)
      if (text) {
        window.pre.writeClipboard(text)
      }
    } catch (e) {
      console.error('OSC 52 clipboard write failed:', e)
    }
    return true
  }

  /**
   * Send OSC 52 response back to the terminal (for read requests)
   * @param {string} base64Data - base64-encoded clipboard content
   */
  _sendResponse (base64Data) {
    if (!this._sendData) return
    // Response format: ESC ] 52 ; c ; <base64> BEL
    const response = `\x1b]52;c;${base64Data}\x07`
    this._sendData(response)
  }

  /**
   * Encode a string to base64 (handles UTF-8 properly)
   */
  _encodeBase64 (str) {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Decode a base64 string (handles UTF-8 properly)
   */
  _decodeBase64 (base64) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  }
}
