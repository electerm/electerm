import { debounce } from 'lodash-es'
import { refsStatic } from '../../common/ref.js'

/**
 * Command suggestions: reading the current input straight from the terminal
 * buffer, positioning the dropdown at the cursor, and the password prompt
 * variant triggered by the shell integration OSC sequences.
 */
export const suggestionsMixin = {
  getCursorPosition () {
    if (!this.term) return null

    // Get the active buffer and cursor position
    const buffer = this.term.buffer.active
    const cursorRow = buffer.cursorY
    const cursorCol = buffer.cursorX

    // Get dimensions from term element
    const termElement = this.term.element
    if (!termElement) return null

    // Get the exact position of the terminal element
    const termRect = termElement.getBoundingClientRect()

    // Calculate cell dimensions
    const cellWidth = termRect.width / this.term.cols
    const cellHeight = termRect.height / this.term.rows

    // Calculate absolute position relative to terminal element
    const left = Math.floor(termRect.left + (cursorCol * cellWidth))
    const top = Math.floor(termRect.top + ((cursorRow + 1) * cellHeight))

    return {
      cellWidth,
      cellHeight,
      left,
      top
    }
  },

  closeSuggestions () {
    refsStatic
      .get('terminal-suggestions')
      ?.closeSuggestions()
  },

  openSuggestions (cursorPos, data) {
    refsStatic
      .get('terminal-suggestions')
      ?.openSuggestions(cursorPos, data)
  },

  /**
   * Read current input directly from terminal buffer
   * This is more reliable than tracking character-by-character
   */
  getCurrentInput () {
    if (!this.term) return ''

    const buffer = this.term.buffer.active
    const cursorY = buffer.cursorY
    const cursorX = buffer.cursorX

    // Get the current line from buffer (baseY + cursorY gives absolute position)
    const absoluteY = buffer.baseY + cursorY
    const line = buffer.getLine(absoluteY)
    if (!line) return ''

    // Get text from start of line up to cursor position
    const lineText = line.translateToString(true, 0, cursorX)

    // Try to extract command after prompt
    // Common prompt endings with trailing space
    const promptEndings = ['$ ', '# ', '> ', '% ', '] ', ') ']

    let commandStart = 0
    for (const ending of promptEndings) {
      const idx = lineText.lastIndexOf(ending)
      if (idx !== -1 && idx + ending.length > commandStart) {
        commandStart = idx + ending.length
      }
    }

    return lineText.slice(commandStart)
  },

  setCurrentInput (value) {
    this.currentInput = value
  },

  /**
   * Handle special input events for command history tracking
   * The actual input reading is done via getCurrentInput from buffer
   */
  handleInputEvent (d) {
    // Handle Enter - add command to history
    if (d === '\r' || d === '\n') {
      const currentCmd = this.getCurrentInput()
      if (currentCmd && currentCmd.trim() && this.shouldUseManualHistory()) {
        window.store.addCmdHistory(currentCmd.trim())
      }
      if (currentCmd && currentCmd.trim() === 'exit') {
        this.userTypeExit = true
      }
      this.closeSuggestions()
    }
  },

  onData (d) {
    this.handleInputEvent(d)
    // Skip normal suggestion logic when in password mode
    const suggestions = refsStatic.get('terminal-suggestions')
    if (suggestions?.state?.passwordMode) {
      if (d === '\r' || d === '\n') {
        this.closeSuggestions()
      }
      return
    }
    if (this.props.config.showCmdSuggestions) {
      if (d === '\r' || d === '\n') {
        this.closeSuggestions()
        return
      }
      // Debounce the suggestion opening to avoid expensive work
      // (buffer read + getBoundingClientRect + React re-render) on every keystroke
      this._debouncedOpenSuggestions()
    } else {
      this.closeSuggestions()
    }
  },

  /**
   * Called by AttachAddonCustom after data is written to the terminal buffer.
   * This fires after server echo arrives, so getCurrentInput() reflects the
   * latest state. We trigger a debounced suggestion refresh so the dropdown
   * updates correctly after backspace, delete, and other edits that rely on
   * server-side echo to update the buffer.
   */
  onTerminalWrite () {
    if (!this.props.config.showCmdSuggestions) {
      return
    }
    const suggestions = refsStatic.get('terminal-suggestions')
    if (suggestions?.state?.showSuggestions && !suggestions?.state?.passwordMode) {
      this._debouncedOpenSuggestions()
    }
  },

  // One debounced runner per terminal, so a keystroke does not trigger a
  // buffer read + layout + re-render for every character.
  _debouncedOpenSuggestions () {
    if (!this._openSuggestionsDebounced) {
      this._openSuggestionsDebounced = debounce(() => {
        const data = this.getCurrentInput()
        if (!data) {
          this.closeSuggestions()
          return
        }
        const cursorPos = this.getCursorPosition()
        this.openSuggestions(cursorPos, data)
      }, 80)
    }
    this._openSuggestionsDebounced()
  },

  onPasswordPromptDetected () {
    window.store.notifyTabPasswordPrompt(this.props.tab.id)
    if (!this.props.config.showCmdSuggestions) {
      return
    }
    const cursorPos = this.getCursorPosition()
    if (cursorPos) {
      refsStatic
        .get('terminal-suggestions')
        ?.openPasswordSuggestions(cursorPos)
    }
  },

  onPasswordPromptCancelled () {
    window.store.clearTabPasswordPrompt(this.props.tab.id)
    const suggestions = refsStatic.get('terminal-suggestions')
    if (suggestions?.state?.passwordMode) {
      suggestions.closeSuggestions()
    }
  },

  getCmd () {
    return this.cmdAddon.getCurrentCommand()
  },

  getCwd () {
    // Use shell integration CWD if available
    if (this.cmdAddon && this.cmdAddon.hasShellIntegration()) {
      const cwd = this.cmdAddon.getCwd()
      if (cwd) {
        this.setCwd(cwd)
        return cwd
      }
    }
    // Fallback: no longer needed with shell integration
    return ''
  },

  setCwd (cwd) {
    this.props.setCwd(cwd, this.state.id)
  },

  shouldUseManualHistory () {
    return !this.cmdAddon || !this.cmdAddon.hasShellIntegration()
  },

  parse (rawText) {
    let result = ''
    const len = rawText.length
    for (let i = 0; i < len; i++) {
      if (rawText[i] === '\b') {
        result = result.slice(0, -1)
      } else {
        result += rawText[i]
      }
    }
    return result
  }
}
