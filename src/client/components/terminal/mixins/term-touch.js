/**
 * Mobile touch support — active only while `store.isTouchDevice` is true.
 *
 * `store.isTouchDevice` is flipped by main.jsx from the real pointer input
 * (mouse → false, touch/pen → true), and a pointerdown always precedes the
 * touch event it stands for, so by the time a touchstart reaches us the flag
 * already reflects the device the user is actually operating. A mouse-driven
 * desktop therefore never enters any of this code, and the whole gesture
 * layer is gated at `onTouchStart` alone: every other handler needs the
 * gesture state that only a touch start can create, so a stray event cannot
 * strand a half-finished gesture when the flag flips mid-gesture.
 *
 * Why this exists at all: xterm.js has **no** touch text selection. Its touch
 * layer maps gestures to scrolling only (`-xterm-gesturestart/-change`, see
 * @xterm/xterm), and `-xterm-gesturetap` has no consumer in core. Every touch
 * terminal therefore has to build selection itself; the previous version here
 * could only ever select a single word, which is what made copying painful.
 *
 * Gesture map (touch mode only):
 *   tap              → clear any selection, focus (opens the soft keyboard)
 *   double tap       → select the word under the finger
 *   triple tap       → select the whole line
 *   long press       → select the word, then KEEP DRAGGING to extend it,
 *                      auto-scrolling while the finger is past an edge
 *   release, dragged → copy (copyWhenSelect on) or open the menu
 *   release, no drag → open the menu, exactly as before
 *   two fingers      → left alone: xterm's own pinch/scroll handling
 *
 * Dragging out a selection is only ever an approximation of what a phone user
 * expects, so the menu also offers "select text" (see onSelectTextMode): it
 * opens the whole buffer in a full-screen read-only textarea where the OS
 * supplies real selection handles. That overlay is an ordinary DOM surface, so
 * `onTouchStart` bails out of it — see isInsideSelectText().
 *
 * Two things that are easy to get wrong:
 *  - `term.select()` takes a BUFFER-ABSOLUTE row, not a viewport row. Passing
 *    the raw viewport row selects the wrong text as soon as the user has
 *    scrolled back — that was a real bug in the single-word version.
 *  - xterm registers its touch listeners on `document`, while React's root
 *    container sits below it, so our `onTouchMove` runs first and a plain
 *    `stopPropagation()` is enough to veto xterm's scroll for the duration of
 *    the drag. `preventDefault()` is not an option: React listens to
 *    `touchmove` passively, so it is ignored (with a console warning).
 */

const DEFAULT_WORD_SEPARATOR = './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~ ?'

// the select-text overlay; its own native selection must stay out of the
// terminal gesture layer
const SELECT_TEXT_CLASS = '.terminal-select-text'

// tap detection
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24

// edge auto-scroll: a short delay before it kicks in, then one scroll step
// per interval
const AUTOSCROLL_DELAY = 260
const AUTOSCROLL_INTERVAL = 60

export const touchMixin = {
  isTouchMode () {
    const store = window.store
    return !!(store && store.isTouchDevice)
  },

  // ---- gesture entry points, wired up in terminal.jsx ----

  onTouchStart (e) {
    // the one and only touch-mode gate — see the file header
    if (!this.isTouchMode()) {
      return
    }
    // the select-text overlay is a normal DOM surface: its native selection
    // gestures must not be recycled into terminal gestures. Only a touchstart
    // is checked, which is enough — the other handlers need gesture state that
    // only a touchstart can create.
    if (this.isInsideSelectText(e)) {
      return
    }
    // two or more fingers mean zoom/scroll for xterm; abort whatever we were
    // doing and stay out of the way
    if (e.touches.length !== 1) {
      this.cancelTouchGesture()
      return
    }
    this.cancelTouchGesture()
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
    // nothing in flight → not our gesture (this also covers touch mode being
    // off, since only a gated onTouchStart can put state in flight)
    if (!this.dragSelect && !this.touchStartPos) {
      return
    }
    const touch = e.touches[0]
    if (!touch) {
      return
    }
    if (this.dragSelect) {
      // veto xterm's document-level gesture handler so the drag selects
      // instead of scrolling
      e.stopPropagation()
      this.lastDragTouch = {
        clientX: touch.clientX,
        clientY: touch.clientY
      }
      this.dragSelect.moved = true
      this.scheduleDragUpdate()
      return
    }
    const dx = touch.clientX - this.touchStartPos.clientX
    const dy = touch.clientY - this.touchStartPos.clientY
    if (Math.sqrt(dx * dx + dy * dy) > this.longPressMoveTolerance) {
      // it is a scroll/pan, not a long press — hand it back to xterm
      this.cancelLongPress()
    }
  },

  onTouchEnd (e) {
    const gesture = this.dragSelect
    const startPos = this.touchStartPos
    const longPressed = this.longPressFired

    clearTimeout(this.longPressTimer)
    this.longPressTimer = null

    // touchmove is coalesced to one update per frame, so flush the pending
    // frame here to make the final selection match where the finger lifted
    if (gesture && gesture.moved && this.lastDragTouch) {
      const coords = this.toBufferCoords(
        this.lastDragTouch.clientX,
        this.lastDragTouch.clientY
      )
      if (coords) {
        this.applySelection(gesture.anchor, coords)
      }
    }
    window.cancelAnimationFrame(this.dragFrame)
    this.dragFrame = 0
    this.stopAutoScroll()
    this.dragSelect = null
    this.lastDragTouch = null
    this.touchStartPos = null
    this.longPressFired = false

    if (gesture) {
      if (gesture.moved && this.props.config.copyWhenSelect) {
        // mobile has no Ctrl+C — copy on release and skip the menu; the
        // selection stays visible so the user can still see what was copied
        this.copySelectionToClipboard()
        return
      }
      // no drag, or auto-copy off: the menu is the way to act on the
      // selection, and its Copy item now covers a real multi-line range
      // instead of a single word. Anchor it under the finger that lifted,
      // which for a long drag is where the user is actually looking.
      const endTouch = gesture.moved && e.changedTouches && e.changedTouches[0]
      this.openContextMenuAt(
        endTouch ? endTouch.clientX : gesture.clientX,
        endTouch ? endTouch.clientY : gesture.clientY,
        gesture.target
      )
      return
    }
    if (longPressed) {
      // long pressed on a separator/blank cell, so nothing got selected —
      // still offer the menu, as before
      if (startPos) {
        this.openContextMenuAt(startPos.clientX, startPos.clientY, startPos.target)
      }
      return
    }
    if (!startPos) {
      // the gesture turned into a scroll, which is xterm's job
      return
    }
    this.handleTap(e.changedTouches[0])
  },

  /**
   * A tap that never became a drag: single → focus + drop the selection,
   * double → select the word, triple → select the line.
   */
  handleTap (touch) {
    if (!touch || !this.term) {
      return
    }
    const { clientX, clientY } = touch
    const now = Date.now()
    const near = this.lastTapPos &&
      Math.abs(clientX - this.lastTapPos.clientX) < DOUBLE_TAP_PX &&
      Math.abs(clientY - this.lastTapPos.clientY) < DOUBLE_TAP_PX
    this.tapCount = (now - this.lastTapTime < DOUBLE_TAP_MS && near)
      ? this.tapCount + 1
      : 1
    this.lastTapTime = now
    this.lastTapPos = { clientX, clientY }

    if (this.tapCount === 2 && this.selectWordAt(clientX, clientY)) {
      this.term.focus()
      return
    }
    if (this.tapCount >= 3) {
      this.tapCount = 0
      const coords = this.toBufferCoords(clientX, clientY)
      if (coords) {
        // selectLines() takes buffer-absolute line indices, same as select()
        this.term.selectLines(coords.absRow, coords.absRow)
        this.term.focus()
        return
      }
    }
    if (this.term.hasSelection()) {
      this.term.clearSelection()
    }
    // xterm's own touch handler calls preventDefault()/stopPropagation() on
    // touchstart/touchend, which suppresses the synthesised mousedown xterm
    // relies on to focus its hidden helper textarea — so a tap never focuses
    // the terminal by itself and the soft keyboard would never open. Focusing
    // here runs synchronously inside the user gesture, so iOS/Android show it.
    this.term.focus()
  },

  handleLongPress () {
    if (!this.touchStartPos || this.state.loading) {
      return
    }
    this.longPressFired = true
    // a long press is not part of any tap sequence
    this.tapCount = 0
    this.lastTapPos = null
    const { clientX, clientY, target } = this.touchStartPos

    const anchor = this.selectWordAt(clientX, clientY)

    // pasteWhenContextMenu means "long press pastes" — honour that contract
    // and never take over the gesture with a drag
    if (this.props.config.pasteWhenContextMenu) {
      this.onPaste()
      return
    }
    if (!anchor) {
      return
    }
    this.dragSelect = {
      anchor,
      moved: false,
      clientX,
      clientY,
      target
    }
    this.lastDragTouch = { clientX, clientY }
  },

  isInsideSelectText (e) {
    const target = e.target
    return !!(target && target.closest && target.closest(SELECT_TEXT_CLASS))
  },

  // ---- select-text overlay ----
  // The full-screen read-only textarea behind the menu's "select text" item.
  // Dragging a selection out on the canvas is only ever an approximation of a
  // native one, so this hands the whole buffer to the platform instead; the
  // component itself is ./terminal-select-text.jsx.

  onSelectTextMode () {
    const text = this.getSelectableBufferText()
    if (!text) {
      return
    }
    this.setState({
      selectTextVisible: true,
      selectTextContent: text
    })
  },

  handleSelectTextClose () {
    this.setState({
      selectTextVisible: false,
      selectTextContent: ''
    })
  },

  handleSelectTextAll () {
    const el = this.selectTextRef.current
    if (!el) {
      return
    }
    // readOnly, so this does not raise the soft keyboard; the element still
    // has to be focused or browsers will not paint the selection
    el.focus({ preventScroll: true })
    el.setSelectionRange(0, el.value.length)
  },

  handleSelectTextCopy () {
    const el = this.selectTextRef.current
    if (!el) {
      return
    }
    const { value, selectionStart, selectionEnd } = el
    // nothing selected by hand → "copy" means the whole buffer, which is what
    // a phone user means after opening this panel
    this.copyToClipboard(
      selectionEnd > selectionStart
        ? value.slice(selectionStart, selectionEnd)
        : value
    )
  },

  // ---- selection plumbing ----

  /**
   * Selects the word under the point and returns the anchor a following drag
   * extends from. The anchor is the word start, so a drag always keeps the
   * whole word. Returns null when there is no usable coordinate mapping.
   */
  selectWordAt (clientX, clientY) {
    if (!this.term) {
      return null
    }
    const coords = this.toBufferCoords(clientX, clientY)
    if (!coords) {
      return null
    }
    const { col, absRow } = coords
    const anchor = { col, absRow }
    const line = this.term.buffer.active.getLine(absRow)
    if (!line) {
      return anchor
    }
    const text = line.translateToString(true)
    const wordSeparator = this.props.config.terminalWordSeparator ||
      DEFAULT_WORD_SEPARATOR

    // touched a blank/separator cell: nothing to expand, but it is still a
    // valid place to start dragging from
    const char = col < text.length ? text[col] : ''
    if (!char || wordSeparator.includes(char)) {
      return anchor
    }

    let start = col
    while (start > 0 && !wordSeparator.includes(text[start - 1])) {
      start--
    }
    let end = col
    while (end < text.length && !wordSeparator.includes(text[end])) {
      end++
    }
    if (end > start) {
      this.term.select(start, absRow, end - start)
    }
    return { col: start, absRow }
  },

  /**
   * Client point → buffer cell. `beyond` is -1/1 while the finger is above or
   * below the screen area, which is what drives edge auto-scrolling.
   */
  toBufferCoords (clientX, clientY) {
    const term = this.term
    if (!term || !term.element || !term.cols || !term.rows) {
      return null
    }
    // measure against the screen element (exactly cols × rows cells) rather
    // than the whole `.xterm` box, whose padding and scrollbar would skew the
    // mapping by a growing amount the further the finger moves
    const screen = term.element.querySelector('.xterm-screen') || term.element
    const rect = screen.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return null
    }
    const cellWidth = rect.width / term.cols
    const cellHeight = rect.height / term.rows
    const col = Math.min(
      term.cols - 1,
      Math.max(0, Math.floor((clientX - rect.left) / cellWidth))
    )
    const viewportRow = Math.min(
      term.rows - 1,
      Math.max(0, Math.floor((clientY - rect.top) / cellHeight))
    )
    return {
      col,
      beyond: clientY < rect.top ? -1 : (clientY > rect.bottom ? 1 : 0),
      // the selection model stores buffer-absolute rows, not viewport rows
      absRow: term.buffer.active.viewportY + viewportRow
    }
  },

  /**
   * Selects from `a` to `b`, in either direction.
   *
   * `term.select()` only accepts "start + length" — it clears any end point,
   * so a backwards drag has to be normalised to min/max. The length is a
   * linear character count across buffer rows, matching xterm's own
   * `toSelectionLength = cols * (endY - startY) + (endX - startX + 1)` and the
   * inverse in `finalSelectionEnd`, which is why a multi-line drag needs no
   * private API.
   */
  applySelection (a, b) {
    if (!this.term || !a || !b) {
      return
    }
    const forward = a.absRow < b.absRow ||
      (a.absRow === b.absRow && a.col <= b.col)
    const start = forward ? a : b
    const end = forward ? b : a
    const length = this.term.cols * (end.absRow - start.absRow) +
      (end.col - start.col + 1)
    this.term.select(start.col, start.absRow, Math.max(1, length))
  },

  /**
   * Coalesces touchmove to one update per frame: every `term.select()` fires
   * `onSelectionChange`, and the terminal re-renders on that, so a raw
   * per-event update makes the drag stutter on slower phones.
   */
  scheduleDragUpdate () {
    if (this.dragFrame) {
      return
    }
    this.dragFrame = window.requestAnimationFrame(() => {
      this.dragFrame = 0
      const gesture = this.dragSelect
      const touch = this.lastDragTouch
      if (!gesture || !touch) {
        return
      }
      const coords = this.toBufferCoords(touch.clientX, touch.clientY)
      if (!coords) {
        return
      }
      this.applySelection(gesture.anchor, coords)
      this.autoScrollFrom(coords.beyond)
    })
  },

  /**
   * Keeps scrolling while the finger is held past the top/bottom edge, and
   * re-extends the selection as the buffer moves under it. The anchor is in
   * absolute coordinates, so it stays put while the viewport scrolls.
   */
  autoScrollFrom (beyond) {
    if (!beyond) {
      this.stopAutoScroll()
      return
    }
    if (this.autoScrollDir === beyond) {
      return
    }
    this.stopAutoScroll()
    this.autoScrollDir = beyond
    const tick = () => {
      if (!this.autoScrollDir || !this.dragSelect) {
        return
      }
      this.term.scrollLines(this.autoScrollDir)
      const touch = this.lastDragTouch
      if (touch) {
        const coords = this.toBufferCoords(touch.clientX, touch.clientY)
        if (coords) {
          this.applySelection(this.dragSelect.anchor, coords)
        }
      }
      this.timers.touchAutoScroll = setTimeout(tick, AUTOSCROLL_INTERVAL)
    }
    this.timers.touchAutoScroll = setTimeout(tick, AUTOSCROLL_DELAY)
  },

  stopAutoScroll () {
    this.autoScrollDir = 0
    clearTimeout(this.timers.touchAutoScroll)
    this.timers.touchAutoScroll = null
  },

  /**
   * Opens the antd context-menu dropdown at the finger position by
   * dispatching a synthetic `contextmenu` event, so the `contextMenu` trigger
   * (and its positioning) is handled by antd exactly like a desktop
   * right-click.
   */
  openContextMenuAt (clientX, clientY, target) {
    if (!target || this.props.config.pasteWhenContextMenu) {
      return
    }
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY
    })
    target.dispatchEvent(event)
  },

  cancelLongPress () {
    clearTimeout(this.longPressTimer)
    this.longPressTimer = null
    this.touchStartPos = null
    this.longPressFired = false
  },

  cancelTouchGesture () {
    this.cancelLongPress()
    this.stopAutoScroll()
    window.cancelAnimationFrame(this.dragFrame)
    this.dragFrame = 0
    this.dragSelect = null
    this.lastDragTouch = null
  }
}
