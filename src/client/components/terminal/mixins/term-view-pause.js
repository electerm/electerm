import { refsStatic } from '../../common/ref.js'
import { rendererTypes } from '../../../common/constants.js'
import { getKeyCombo, matchesShortcut } from '../../shortcuts/terminal-key-combo.js'

export const viewPauseMixin = {
  subscribeViewPaused (notify) {
    this.onViewPausedChange = notify
    return () => { delete this.onViewPausedChange }
  },

  isViewPaused () {
    return this.state.viewPaused
  },

  onResumeView () {
    this.setViewPaused(false)
  },

  disposePausedView () {
    const view = this.pausedTerm
    this.pausedTerm = null
    view?.dispose()
  },

  setViewPaused (viewPaused) {
    if (!this.term || this.onClose) return
    if (viewPaused && window.store.termSearchOpen) {
      refsStatic.get('term-search')?.close()
    }
    this.setState({
      viewPaused,
      hasSelection: !viewPaused && this.term.hasSelection()
    }, () => {
      if (!viewPaused && this.term && !this.onClose) {
        this.term.scrollToBottom()
        this.term.focus()
      }
    })
  },

  // A second, read-only xterm owns only the frozen buffer. The attached
  // terminal keeps parsing the live session, including while this tab is hidden.
  mountPausedView (element) {
    this.disposePausedView()
    const live = this.term
    if (!element || !live || !this.serializeAddon || this.onClose) return
    const { Terminal, Unicode11Addon } = window.xtermAddons
    const view = new Terminal({
      cols: live.cols,
      rows: live.rows,
      scrollback: live.options.scrollback,
      theme: this.getRendererThemeConfig(this.props.themeConfig, rendererTypes.dom),
      fontFamily: live.options.fontFamily,
      fontSize: live.options.fontSize,
      allowTransparency: true,
      allowProposedApi: true,
      disableStdin: true,
      cursorInactiveStyle: 'none'
    })
    this.pausedTerm = view
    view.loadAddon(new Unicode11Addon())
    view.unicode.activeVersion = live.unicode.activeVersion
    view.open(element)
    this.fixSelectionColors(view)
    const { viewportY, length, type } = live.buffer.active
    // Two screens above and one below keep nearby lines selectable. Capturing
    // a busy pane costs the same whether it has hundreds or thousands of rows.
    const start = Math.max(0, viewportY - 2 * live.rows)
    const end = Math.min(length - 1, viewportY + 2 * live.rows - 1)
    // range addresses the normal buffer. For a full-screen app the addon
    // serializes its alternate screen separately, after the normal screen.
    const options = type === 'alternate' ? { scrollback: 0 } : { range: { start, end } }
    view.write(this.serializeAddon.serialize({ ...options, excludeModes: true }) + '\x1b[?25l', () => {
      if (view === this.pausedTerm) view.scrollToLine(viewportY - start)
    })
    view.onSelectionChange(this.onSelectionChange)
    view.onSelectionChange(this.onSelection)
    view.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown' || !view.hasSelection()) return true
      if (matchesShortcut(getKeyCombo(event), this.getShortcut('terminal_copy'))) {
        event.preventDefault()
        this.onCopy()
        return false
      }
      return true
    })
  }
}
