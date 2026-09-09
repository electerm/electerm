/**
 * Mobile touch support.
 * On touch devices, long-press should (1) select the word under the finger
 * and (2) open the context menu — mirroring desktop right-click behaviour.
 * xterm.js only uses touch events for scrolling, so we add explicit
 * long-press detection here.
 */
export const touchMixin = {
  onTouchStart (e) {
    if (e.touches.length !== 1) {
      return
    }
    const touch = e.touches[0]
    this.touchStartPos = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: e.currentTarget
    }
    this.longPressFired = false
    clearTimeout(this.longPressTimer)
    this.longPressTimer = setTimeout(() => {
      this.handleLongPress()
    }, this.longPressThreshold)
  },

  onTouchMove (e) {
    if (!this.touchStartPos) {
      return
    }
    const touch = e.touches[0]
    const dx = touch.clientX - this.touchStartPos.clientX
    const dy = touch.clientY - this.touchStartPos.clientY
    if (Math.sqrt(dx * dx + dy * dy) > this.longPressMoveTolerance) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
      this.touchStartPos = null
    }
  },

  onTouchEnd () {
    const wasTap = this.touchStartPos && !this.longPressFired
    clearTimeout(this.longPressTimer)
    this.longPressTimer = null
    this.touchStartPos = null
    // xterm's own touch (Gesture) handler calls preventDefault()/stopPropagation()
    // on touchstart/touchend, which suppresses the synthesised mousedown xterm
    // relies on to focus its hidden helper textarea. As a result a tap never
    // focuses the terminal on touch devices, so the soft keyboard never opens
    // and you cannot type. Focus explicitly on a clean tap (not a long-press,
    // not a scroll) so mobile input works. The focus() runs synchronously inside
    // this user-gesture handler, so iOS/Android will show the keyboard.
    if (wasTap && this.term) {
      this.term.focus()
    }
  },

  handleLongPress () {
    if (!this.touchStartPos || this.state.loading) {
      return
    }
    this.longPressFired = true
    const { clientX, clientY, target } = this.touchStartPos

    // Select the word at the touch position (same as desktop right-click word
    // select) so the user can immediately copy or act on it.
    this.selectWordAt(clientX, clientY)

    // Respect pasteWhenContextMenu: when enabled, long-press pastes instead
    // of showing the menu (same as desktop right-click).
    if (this.props.config.pasteWhenContextMenu) {
      this.onPaste()
      return
    }

    // Dispatch a synthetic contextmenu event so antd Dropdown's contextMenu
    // trigger opens the menu at the exact finger position.
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY
    })
    target.dispatchEvent(event)
  },

  selectWordAt (clientX, clientY) {
    if (!this.term) {
      return
    }
    const termElement = this.term.element
    if (!termElement) {
      return
    }
    const rect = termElement.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return
    }

    const cellWidth = rect.width / this.term.cols
    const cellHeight = rect.height / this.term.rows
    const col = Math.floor(x / cellWidth)
    const row = Math.floor(y / cellHeight)

    const buffer = this.term.buffer.active
    const line = buffer.getLine(row)
    if (!line) {
      return
    }

    const text = line.translateToString(true)
    const wordSeparator = this.props.config.terminalWordSeparator ||
      ' ./\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~ ?'

    // If the touched cell is empty or a separator, nothing to select
    if (col >= text.length || wordSeparator.includes(text[col])) {
      return
    }

    // Find word start
    let start = col
    while (start > 0 && !wordSeparator.includes(text[start - 1])) {
      start--
    }
    // Find word end
    let end = col
    while (end < text.length && !wordSeparator.includes(text[end])) {
      end++
    }

    if (end > start) {
      this.term.select(start, row, end - start)
    }
  }
}
