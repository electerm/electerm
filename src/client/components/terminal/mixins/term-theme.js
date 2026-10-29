import { logTerminalRender } from '../terminal-render-diagnostics.mjs'
import deepCopy from 'json-deep-copy'
import { loadWebglAddon } from '../xterm-loader.js'
import { rendererTypes } from '../../../common/constants.js'
import {
  createRendererThemeConfig,
  handleTerminalColorQuery,
  blendSelectionOverBackground,
  resolveRendererThemeType
} from '../terminal-color-query.mjs'
import {
  activateWebglAddon,
  disposeWebglAddon,
  invalidateWebglGlyphTextures
} from '../terminal-render-recovery.mjs'
import {
  createTerminalRendererLifecycle,
  getRendererTarget,
  resolveWebglAllowed
} from '../terminal-render-lifecycle.mjs'
import {
  isWebglAllowed,
  tripWebglCircuit
} from '../terminal-webgl-circuit-breaker.mjs'

/**
 * Renderer (DOM / WebGL) and theming, including the OSC 10/11 colour query
 * handlers that let shells ask the terminal for its background colour.
 *
 * Renderer ownership: `setupRendererLifecycle()` builds one
 * terminal-render-lifecycle controller per terminal. That controller decides
 * DOM vs WebGL from visibility, config and the page-level circuit breaker, and
 * is the only owner of `webglAddon` — activation goes through
 * `activateVisibleWebglRenderer`, release through `deactivateWebglRenderer`.
 */
export const themeMixin = {
  setupRendererLifecycle () {
    if (this.rendererLifecycle) {
      return this.rendererLifecycle
    }
    this.rendererLifecycle = createTerminalRendererLifecycle({
      getTarget: () => getRendererTarget({
        disposed: !!this.onClose,
        rendererType: this.props.config.rendererType,
        visible: this.isElementVisible(),
        // 激活失败（动态 import / addon 构造 / loadAddon 抛错）与熔断同级：
        // WebGL 在这台机器上已经证明不可用，不能让每次 commit 的 reconcile
        // 再走一遍「创建 context → 失败 → 释放」。只在用户显式 DOM→WebGL
        // 配置切换时随熔断一起复位（见 mixins/term-config.jsx）。
        webglAllowed: resolveWebglAllowed(
          isWebglAllowed(),
          this.webglActivationFailed
        )
      }),
      activate: options => this.activateVisibleWebglRenderer(options),
      deactivate: options => this.deactivateWebglRenderer(options),
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: id => window.cancelAnimationFrame(id),
      onStateChange: snapshot => {
        // 释放链的尾部没有 catch：本回调一旦抛错，reconcile/fallback 的调用方
        // 就会永远 await，所以这里必须吞掉全部异常。
        try {
          this.rendererState = snapshot.state
          this.rendererGeneration = snapshot.generation
          logTerminalRender(this, 'renderer-state-change', {
            reason: snapshot.reason
          })
        } catch (error) {
          console.error('renderer state listener failed', error)
        }
      }
    })
    return this.rendererLifecycle
  },

  reconcileRenderer (reason) {
    if (!this.term || !this.rendererLifecycleReady || this.onClose) {
      return Promise.resolve()
    }
    return this.setupRendererLifecycle().reconcile(reason)
  },

  async activateVisibleWebglRenderer ({ reason, generation, isCurrent }) {
    logTerminalRender(this, 'webgl-activation-request', { reason })
    // 有意接受的规范偏差：规格 8.1 要求「发布 addon 后再应用 WebGL 主题」，
    // 这里在**激活前**就套。代价只有页面加载后首次激活的 import 窗口（10~200 ms）
    // 内 DOM renderer 以不透明底色绘制；之后 loadWebglAddon 命中已加载模块缓存，
    // 这个窗口≈0。收益是激活成功的那一帧不再发生「透明 DOM → 不透明 WebGL」的
    // 闪烁（激活后再套会让同一帧先以 DOM 透明主题绘制一次）。请勿照规格改回去。
    this.applyTerminalTheme(false, this.term, rendererTypes.webGL)
    let activated
    try {
      activated = await activateWebglAddon({
        loadWebglAddon,
        term: this.term,
        onContextLost: this.handleUnexpectedWebglContextLoss,
        isCurrent,
        onActivated: ({ webglAddon, contextLossDisposable }) => {
          this.webglAddon = webglAddon
          this.webglContextLossDisposable = contextLossDisposable
          this.rendererGeneration = generation
          logTerminalRender(this, 'renderer-activated', { reason })
        },
        onError: error => {
          logTerminalRender(this, 'activation-cleanup-failed', { error })
          console.error(error)
        }
      })
    } catch (error) {
      // 动态 import / addon 构造 / loadAddon 失败：终端必须安全停在 DOM，
      // 主题也要拉回 DOM（激活前已套用 WebGL 主题）。错误继续抛出，由 controller
      // 映射为 DOM_FALLBACK，它自己不记录原因，所以这里必须留下现场日志。
      logTerminalRender(this, 'webgl-activation-failed', { reason, error })
      console.error(error)
      // 标记这台终端不要再自动重试 WebGL，否则每次 commit 的 reconcile 都会
      // 重新创建 context，并在「先套 WebGL 主题、失败再拉回 DOM 主题」之间闪烁
      this.webglActivationFailed = true
      // activateWebglAddon 在 onActivated 抛错时会自己先 disposeWebglAddon 再
      // rethrow，此时 this.webglAddon 仍指向一个**已释放**的 addon。必须在这里
      // 摘掉引用（与 deactivateWebglRenderer 一致），否则 applyTerminalTheme()
      // 的默认参数（!!this.webglAddon）会让这台终端拿到不透明的 WebGL 主题、
      // 诊断里的 state.webgl 说谎、后续 deactivateWebglRenderer 会二次 dispose。
      this.webglAddon = null
      this.webglContextLossDisposable = null
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      throw error
    }
    if (!activated) {
      // helper 已释放过期 addon，这里不能留下任何引用
      logTerminalRender(this, 'webgl-activation-stale', { reason })
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      return false
    }
    invalidateWebglGlyphTextures(this.webglAddon)
    this.fitAndRefresh()
    return true
  },

  /**
   * 幂等：先摘掉实例引用再释放，可安全承受并发/重复调用（controller 在若干
   * 路径上会对同一终端重复调用本方法）。
   */
  deactivateWebglRenderer ({ reason, releaseContext = true } = {}) {
    const webglAddon = this.webglAddon
    const contextLossDisposable = this.webglContextLossDisposable
    this.webglAddon = null
    this.webglContextLossDisposable = null
    disposeWebglAddon({
      webglAddon,
      contextLossDisposable,
      releaseContext,
      onError: error => {
        logTerminalRender(this, 'renderer-dispose-failed', { error })
        console.error(error)
      }
    })
    if (this.term && !this.onClose) {
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      this.term.refresh(0, this.term.rows - 1)
      // 规格 8.3 步骤 5：降级后当前可见终端要 fit + refresh，这是「DOM 恢复后
      // 文字完整」的机械保障点之一（仅 refresh 不重算 cols/rows）。fitAndRefresh()
      // 自带 isElementVisible() 守卫，所以隐藏终端的正常隐藏释放路径在这里安全
      // no-op，不会破坏它。
      this.fitAndRefresh()
    }
    logTerminalRender(this, 'renderer-dispose', {
      reason,
      intentionalRelease: releaseContext
    })
  },

  /**
   * 真实 context loss：先降级到 DOM（不 release 这个已经丢失的 context），
   * 再熔断整页 WebGL，让其他终端也显式释放各自健康的 context。
   */
  handleUnexpectedWebglContextLoss () {
    if (this.onClose) {
      return
    }
    logTerminalRender(this, 'context-lost', {
      reason: 'unexpected context loss',
      intentionalRelease: false
    })
    this.rendererLifecycle
      ?.fallback('unexpected context loss', { releaseContext: false })
      .finally(() => {
        logTerminalRender(this, 'dom-fallback-activated', {
          reason: 'unexpected context loss'
        })
        // 熔断必须等本实例以 releaseContext: false 完成降级之后再进行，顺序不可调换：
        // 熔断是同步广播的，提前调用会立刻触发本实例自己的 circuit 订阅
        // （terminal.jsx 的 subscribeWebglCircuit）→ reconcileRenderer('circuit tripped')
        // → 目标变 domFallback → deactivateTo(..., releaseContext: true) → 对**已经丢失**的
        // context 调用 loseContext()，正是 releaseContext: false 要避免的事。
        tripWebglCircuit('unexpected context loss')
      })
      // finally 会把降级失败继续抛出；无人 await 这条链，必须自行收尾
      .catch(error => console.error('renderer fallback failed', error))
  },

  disposeTerminalColorQueryHandlers () {
    this.terminalColorQueryDisposables.forEach(disposable => disposable?.dispose?.())
    this.terminalColorQueryDisposables.length = 0
  },

  getVisibleTerminalBackground () {
    const uiThemeConfig = window.store?.getUiThemeConfig?.() || {}
    // The store value (uiThemeConfig.main) is always immediately up-to-date
    // when the theme changes, because it reads directly from store.config.theme.
    // The CSS --main variable lags behind because UiTheme's useEffect runs
    // asynchronously after componentDidUpdate. So we prioritise the store
    // value, and only fall back to CSS (for custom-CSS edge cases) or the
    // terminal theme background (last resort).
    const root = document.documentElement
    const cssMain = root && window.getComputedStyle
      ? window.getComputedStyle(root).getPropertyValue('--main').trim()
      : ''
    return uiThemeConfig.main || cssMain || this.props.themeConfig.background
  },

  getVisibleTerminalForeground () {
    const uiThemeConfig = window.store?.getUiThemeConfig?.() || {}
    return uiThemeConfig.text
  },

  registerTerminalColorQueryHandlers (term, themeConfig = {}) {
    this.disposeTerminalColorQueryHandlers()
    if (!term?.parser?.registerOscHandler) {
      return
    }
    const background = this.getVisibleTerminalBackground()
    const foregroundFallback = this.getVisibleTerminalForeground()
    this.terminalColorQueryDisposables.push(
      term.parser.registerOscHandler(10, data => {
        return handleTerminalColorQuery(term, 10, themeConfig.foreground, foregroundFallback, data)
      }),
      term.parser.registerOscHandler(11, data => {
        return handleTerminalColorQuery(term, 11, background, themeConfig.background, data)
      })
    )
  },

  getRendererThemeConfig (
    themeConfig = this.props.themeConfig,
    rendererType = resolveRendererThemeType(!!this.webglAddon, rendererTypes)
  ) {
    return createRendererThemeConfig(
      deepCopy(themeConfig),
      rendererType,
      this.getVisibleTerminalBackground()
    )
  },

  /**
   * Apply the current renderer theme to the terminal and trigger a repaint.
   *
   * `rendererType` must be the renderer actually in use, never the configured
   * one: after the circuit breaker falls back to DOM the terminal still has
   * `config.rendererType === 'webGL'` but needs the transparent DOM theme.
   * Callers that know the renderer they are switching to (the activation and
   * fallback paths in `activateVisibleWebglRenderer`/`deactivateWebglRenderer`)
   * must pass it explicitly; the default reads the addon actually held.
   *
   * When `deferred` is true and the renderer is WebGL, a second repaint is
   * scheduled on the next animation frame so the theme picks up CSS --main
   * changes that UiTheme's useEffect applies asynchronously after
   * componentDidUpdate. The optional `term` parameter is used during
   * initTerminal, where this.term hasn't been assigned yet.
   */
  applyTerminalTheme (
    deferred = false,
    term = this.term,
    rendererType = resolveRendererThemeType(!!this.webglAddon, rendererTypes)
  ) {
    if (!term || this.onClose) {
      return
    }
    term.options.theme = this.getRendererThemeConfig(this.props.themeConfig, rendererType)
    this.fixSelectionColors(term)
    term.refresh(0, term.rows - 1)
    if (deferred && rendererType === rendererTypes.webGL) {
      window.cancelAnimationFrame(this.timers.themeRaf)
      this.timers.themeRaf = window.requestAnimationFrame(() => {
        if (!this.term || this.onClose) {
          return
        }
        this.term.options.theme = this.getRendererThemeConfig(this.props.themeConfig, rendererType)
        this.fixSelectionColors(this.term)
        this.term.refresh(0, this.term.rows - 1)
      })
    }
  },

  /**
   * xterm computes its DOM selection colour as blend(theme.background,
   * selectionBackground). The terminal background is forced transparent
   * (rgba(0,0,0,0)) so electerm's own CSS background / image shows through,
   * which makes the blend run over transparent-black. Recompute the selection
   * colours over the real visible background, from the *configured* theme
   * colours — xterm's internal selectionBackgroundTransparent forces opaque
   * colours down to 0.3 alpha (xterm#2737), which would make every selection
   * translucent even when the user configured an opaque one.
   */
  fixSelectionColors (term) {
    const themeConfig = this.props.themeConfig || {}
    const themeService = term?._core?._themeService
    if (!themeService?.modifyColors) {
      return
    }
    const visibleBackground = this.getVisibleTerminalBackground()
    // xterm's DEFAULT_SELECTION, used when the theme omits a selection color
    const selectionFallback = 'rgba(255, 255, 255, 0.3)'
    const inactiveFallback = themeConfig.selectionBackground || selectionFallback
    themeService.modifyColors((c) => {
      const active = blendSelectionOverBackground(
        visibleBackground,
        themeConfig.selectionBackground || selectionFallback
      )
      if (active) {
        c.selectionBackgroundOpaque = active
      }
      const inactive = blendSelectionOverBackground(
        visibleBackground,
        themeConfig.selectionInactiveBackground || inactiveFallback
      )
      if (inactive) {
        c.selectionInactiveBackgroundOpaque = inactive
      }
    })
  }
}
