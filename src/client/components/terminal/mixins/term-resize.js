import { logTerminalRender } from '../terminal-render-diagnostics.mjs'
import { throttle } from 'lodash-es'
import { resizeTerm } from '../terminal-apis.js'
import { minTerminalFontSize } from '../../../common/constants.js'
// platform.js rather than constants.js: the latter pulls in PNG assets at the
// top level, and this flag is all that is needed here.
import { isMac } from '../../../common/platform.js'
import {
  invalidateWebglGlyphTextures,
  refreshTerminalAfterWindowFocus
} from '../terminal-render-recovery.mjs'

/**
 * Sizing: fitting the terminal into its (possibly hidden) container, font
 * zoom, and keeping the remote pty in sync with the on-screen size.
 */
export const resizeMixin = {
  // Whether the terminal's mount container is really visible (not
  // display:none). A hidden tab reports clientWidth/clientHeight 0, where
  // fitting would compute 0 columns.
  isElementVisible () {
    const el = this.domRef.current
    if (!el) {
      return false
    }
    return el.clientWidth > 0 && el.clientHeight > 0
  },

  // Fit the terminal to the container and force a repaint of the visible area.
  // Only fit while the container is really visible: under a hidden tab
  // (display:none) clientWidth is 0 and fitting would compute 0/tiny columns,
  // wrapping the shell prompt character by character and producing the fake or
  // duplicated prompts seen when several connections are opened quickly. So a
  // hidden terminal keeps xterm's default 80x24 and is fitted when the tab
  // becomes visible again, which removes the wrapping damage at the root.
  fitAndRefresh () {
    if (!this.term || !this.fitAddon || this.onClose) {
      return
    }
    if (!this.isElementVisible()) {
      return
    }
    try {
      this.fitAddon.fit()
      this.term.refresh(0, this.term.rows - 1)
    } catch (e) {
      logTerminalRender(this, 'fit-failed', { error: e })
      console.info('resize failed', e)
    }
  },

  /**
   * The terminal became visible again (`source: 'tab-visible'`) or the window
   * regained focus (`source: 'focus'`).
   *
   * Ordering matters: converge this terminal's renderer target first, then
   * repaint. After the breaker trips `webglAddon` is null, so the texture step
   * is skipped and the DOM refresh stands. This path never resets the breaker
   * and never activates anything.
   */
  onWindowFocus (shouldFocus = true, source = 'tab-visible') {
    const reason = source === 'tab-visible' ? 'tab visible' : 'window focus'
    logTerminalRender(this, source === 'tab-visible' ? 'tab-visible' : 'focus-recovery', { shouldFocus })
    // A hidden terminal (e.g. a background pane reached by a global focus
    // event) must not be activated here: with clientWidth/clientHeight 0 the
    // fit computes 0 columns and corrupts the wrapping. Its own WebGL release
    // is handled by the reconcile in componentDidUpdate.
    if (!this.term || this.onClose || !this.isElementVisible()) {
      return
    }
    // The release chain can reject and nothing awaits it here, so it settles
    // its own errors.
    this.reconcileRenderer(reason)
      .catch(error => console.error('focus renderer reconcile failed', error))
    // macOS only: migrating a native-fullscreen window across Spaces can lose
    // the glyph atlas on the GPU without ever firing webglcontextlost, and a
    // plain refresh reuses the CPU-side cache, so those glyphs stay invisible.
    // No other platform does this, so the full re-upload is not paid there.
    const invalidated = isMac && this.webglAddon
      ? invalidateWebglGlyphTextures(this.webglAddon)
      : false
    if (isMac) {
      logTerminalRender(this, 'texture-invalidation', { invalidated })
    }
    refreshTerminalAfterWindowFocus(this.term, shouldFocus)
    window.cancelAnimationFrame(this.timers.focusRefreshRaf)
    this.timers.focusRefreshRaf = window.requestAnimationFrame(() => {
      this.timers.focusRefreshRaf = null
      this.fitAndRefresh()
    })
    // Second, slower fit: one frame after a tab switch the layout is usually
    // final, while a Space restore on macOS can take a few hundred ms to
    // settle the drawing surface.
    clearTimeout(this.timers.focusRefresh)
    this.timers.focusRefresh = setTimeout(() => {
      this.timers.focusRefresh = null
      this.fitAndRefresh()
      logTerminalRender(this, 'recover-settled')
    }, isMac ? 300 : 80)
  },

  // One throttled runner per terminal: a module level one would let tabs
  // throttle each other.
  onResize () {
    if (!this._resizeThrottled) {
      this._resizeThrottled = throttle(() => this.fitAndRefresh(), 200)
    }
    this._resizeThrottled()
  },

  onResizeTerminal (size) {
    const { cols, rows } = size
    resizeTerm(this.pid, cols, rows)
  },

  zoom (v) {
    const { term } = this
    if (!term) {
      return
    }
    const next = Math.max(
      minTerminalFontSize,
      term.options.fontSize + v
    )
    const changed = next - term.options.fontSize
    if (changed === 0) {
      return
    }
    term.options.fontSize = next
    window.store.triggerResize()
    if (this.originalFontSize == null) {
      this.originalFontSize = next - changed
    }
    this.setState({
      fontSizeChanged: next !== this.originalFontSize
    })
  },

  handleResetFontSize () {
    const { term } = this
    if (!term || this.originalFontSize == null) {
      return
    }
    term.options.fontSize = this.originalFontSize
    window.store.triggerResize()
    this.setState({ fontSizeChanged: false })
    term.focus()
  }
}
