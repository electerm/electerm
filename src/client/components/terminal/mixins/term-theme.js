import deepCopy from 'json-deep-copy'
import { loadWebglAddon } from '../xterm-loader.js'
import { rendererTypes } from '../../../common/constants.js'
import {
  createRendererThemeConfig,
  handleTerminalColorQuery,
  blendSelectionOverBackground
} from '../terminal-color-query.mjs'

/**
 * Renderer (DOM / WebGL) and theming, including the OSC 10/11 colour query
 * handlers that let shells ask the terminal for its background colour.
 */
export const themeMixin = {
  async loadRenderer (term, config) {
    // xterm 6.x: only the built-in DOM renderer and the WebGL addon exist
    // (the canvas renderer addon was removed in 6.x). 'dom' = no addon loaded
    // (built-in DOM renderer). Legacy 'canvas' settings fall back to DOM.
    if (config.rendererType === rendererTypes.webGL) {
      try {
        const WebglAddon = await loadWebglAddon()
        const webglAddon = new WebglAddon()
        this.webglAddon = webglAddon
        // On macOS native fullscreen the GPU/WebGL context can be lost when
        // the window migrates across Spaces. Without a listener xterm keeps
        // drawing into a dead context and every terminal goes black while the
        // rest of the UI stays alive. Rebuild the addon to recover.
        this.webglContextLossDisposable = webglAddon.onContextLoss(this.handleWebglContextLoss)
        term.loadAddon(webglAddon)
      } catch (e) {
        console.error('render with webgl failed, fallback to dom renderer')
        console.error(e)
        // built-in DOM renderer is used (no addon loaded)
        this.webglAddon = null
      }
    }
  },

  reloadWebglRenderer (reason = 'reload') {
    console.warn(`webgl renderer ${reason}, rebuilding`)
    try {
      this.webglContextLossDisposable?.dispose?.()
      this.webglContextLossDisposable = null
    } catch (e) {
      console.error(e)
    }
    try {
      this.webglAddon?.dispose?.()
    } catch (e) {
      console.error(e)
    }
    this.webglAddon = null
    const { term } = this
    const { config } = this.props
    return this.loadRenderer(term, config)
      .then(() => {
        term.refresh(0, term.rows - 1)
      })
      .catch(e => {
        console.error(`webgl renderer ${reason} failed`, e)
      })
  },

  handleWebglContextLoss (webglAddon = this.webglAddon) {
    if (this.webglRecovering || !webglAddon) {
      return
    }
    this.webglRecovering = true
    this.reloadWebglRenderer('context loss')
      .finally(() => {
        this.webglRecovering = false
      })
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

  getRendererThemeConfig (themeConfig = this.props.themeConfig) {
    return createRendererThemeConfig(
      deepCopy(themeConfig),
      this.props.config.rendererType,
      this.getVisibleTerminalBackground()
    )
  },

  /**
   * Apply the current renderer theme to the terminal and trigger a repaint.
   * When `deferred` is true (WebGL mode), a second repaint is scheduled on
   * the next animation frame so the theme picks up CSS --main changes that
   * UiTheme's useEffect applies asynchronously after componentDidUpdate.
   * The optional `term` parameter is used during initTerminal, where
   * this.term hasn't been assigned yet.
   */
  applyTerminalTheme (deferred = false, term = this.term) {
    if (!term || this.onClose) {
      return
    }
    term.options.theme = this.getRendererThemeConfig(this.props.themeConfig)
    this.fixSelectionColors(term)
    term.refresh(0, term.rows - 1)
    if (deferred && this.props.config.rendererType === rendererTypes.webGL) {
      window.cancelAnimationFrame(this.timers.themeRaf)
      this.timers.themeRaf = window.requestAnimationFrame(() => {
        if (!this.term || this.onClose) {
          return
        }
        this.term.options.theme = this.getRendererThemeConfig(this.props.themeConfig)
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
