import { logTerminalRender } from '../terminal-render-diagnostics.mjs'
import { throttle } from 'lodash-es'
import { resizeTerm } from '../terminal-apis.js'
import { minTerminalFontSize } from '../../../common/constants.js'
import {
  invalidateWebglGlyphTextures,
  refreshTerminalAfterWindowFocus
} from '../terminal-render-recovery.mjs'

/**
 * Sizing: fitting the terminal into its (possibly hidden) container, font
 * zoom, and keeping the remote pty in sync with the on-screen size.
 */
export const resizeMixin = {
  // 判断终端挂载容器当前是否真实可见（非 display:none）。
  // 隐藏标签的 clientWidth/clientHeight 为 0，此时不应 fit，否则会算出 0 列。
  isElementVisible () {
    const el = this.domRef.current
    if (!el) {
      return false
    }
    return el.clientWidth > 0 && el.clientHeight > 0
  },

  // 重新适配终端尺寸并强制重绘可见区域。
  // 仅当容器真正可见时才 fit：隐藏标签(display:none)下 clientWidth 为 0，
  // 若在此时 fit 会算出 0/极小列数，使 shell 提示符被逐字符错误换行，
  // 出现快速连续打开多个连接时的虚假/重复提示符。因此隐藏态跳过 fit，
  // 保留 xterm 默认 80x24，待标签激活可见后再 fit 重绘，从根上避免换行损坏。
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

  onWindowFocus (shouldFocus = true, source = 'focus') {
    const reason = source === 'tab-visible' ? 'tab visible' : 'window focus'
    logTerminalRender(this, source === 'tab-visible' ? 'tab-visible' : 'focus-recovery', { shouldFocus })
    // 隐藏终端（例如全局 focus 事件遍历到的后台 pane）不得被激活：
    // 它的 clientWidth/clientHeight 为 0，fit 会算出 0 列并损坏换行。
    // 它自己的 WebGL 释放由 componentDidUpdate 里的 reconcile 负责。
    if (!this.term || this.onClose || !this.isElementVisible()) {
      return
    }
    // 先让本终端的 renderer 目标按当前可见性/熔断状态收敛，再谈重绘：
    // 熔断后 webglAddon 为 null，下一步自然跳过纹理失效，回落到 DOM 的
    // refresh。focus 路径不复位熔断器、也不做任何激活。
    // controller 的释放链可能 reject，且无人 await，必须自行收尾。
    this.reconcileRenderer(reason)
      .catch(error => console.error('focus renderer reconcile failed', error))
    // 防御性重传当前终端的 GPU 纹理；普通 refresh 在版本未变时会复用缓存。
    // 不清空共享 CPU atlas，避免其他终端重新生成字形。
    const invalidated = this.webglAddon
      ? invalidateWebglGlyphTextures(this.webglAddon)
      : false
    logTerminalRender(this, 'texture-invalidation', { invalidated })
    refreshTerminalAfterWindowFocus(this.term, shouldFocus)
    window.cancelAnimationFrame(this.timers.focusRefreshRaf)
    this.timers.focusRefreshRaf = window.requestAnimationFrame(() => {
      this.timers.focusRefreshRaf = null
      this.fitAndRefresh()
    })
    clearTimeout(this.timers.focusRefresh)
    this.timers.focusRefresh = setTimeout(() => {
      this.timers.focusRefresh = null
      this.fitAndRefresh()
      logTerminalRender(this, 'recover-settled')
    }, 300)
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
