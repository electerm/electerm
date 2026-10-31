/**
 * Osc52Addon - Handles OSC 52 clipboard escape sequences
 *
 * OSC 52 allows terminal programs (TUI apps like vim, tmux, opencode, etc.)
 * to copy text to the system clipboard.
 *
 * Format: ESC ] 52 ; Pc ; Pd BEL (or ST)
 *   Pc = clipboard selection: c (clipboard), p (primary), s (secondary)
 *   Pd = base64-encoded content, or "?" to read
 *
 * Write request: ESC ] 52 ; c ; <base64data> BEL
 *   -> decodes base64 and writes to system clipboard
 *
 * Read request: ESC ] 52 ; c ; ? BEL
 *   -> REFUSED. A read would hand whatever is on the local clipboard to
 *      whatever host the terminal is connected to, silently and with no user
 *      action, so the sequence is consumed and ignored. Nothing that matters
 *      actually uses it: tmux, vim and neovim only write. Terminals that do
 *      implement read (kitty, iTerm2) prompt or deny by default for exactly
 *      this reason. See GHSA-wv8h-9mm4-9h33.
 */

export class Osc52Addon {
  constructor () {
    this.terminal = undefined
    this._disposables = []
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

    // Only handle clipboard target ('c'), also accept 'c' among multiple targets.
    // An EMPTY target is the spec's "default selection", i.e. the clipboard, and is
    // what tmux sends: `set -g mouse on` + a mouse drag + wheel (to select across
    // screens) makes tmux emit `ESC ] 52 ; ; <base64> BEL` on release. Rejecting an
    // empty target silently drops that payload, so copying from tmux never reaches
    // the system clipboard.
    if (target && !target.includes('c')) return false

    if (payload === '?') {
      // Read request - refuse. Answering it would let any host the user has a
      // terminal open to lift the local clipboard (passwords, passphrases, API
      // tokens) with no prompt. Swallow the sequence so the write path below
      // stays the only thing this addon does.
      return true
    }

    // Write request - decode and write to clipboard
    return this._handleWriteRequest(payload)
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
