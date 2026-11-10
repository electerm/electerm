import message from '../../common/message'
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

// The fallback notice is page-wide and worth showing once only, no matter how
// many terminals lose their context in the same wave. It stays English on
// purpose: a lost WebGL context is rare, and keeping it out of the locale
// package avoids shipping a key that most users never see.
const fallbackNoticeText = 'WebGL renderer disabled after a GPU failure. ' +
  'Terminals use the built-in DOM renderer now; switch the renderer setting ' +
  'to re-enable WebGL.'

let fallbackNoticeShown = false

function notifyWebglFallback () {
  if (fallbackNoticeShown) {
    return
  }
  fallbackNoticeShown = true
  message.warning(fallbackNoticeText, 8)
}

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
        // An activation failure (dynamic import / addon constructor /
        // loadAddon threw) ranks with the breaker: WebGL has proved unusable
        // on this machine, and every commit's reconcile must not walk
        // "create context -> fail -> release" again. Reset together with the
        // breaker on an explicit DOM -> WebGL config switch, see
        // mixins/term-config.jsx.
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
        // Nothing awaits the tail of the release chain, so a throw in here
        // would leave the reconcile/fallback caller awaiting forever. Every
        // exception must be swallowed.
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
    // Deliberate deviation from spec 8.1, which wants the WebGL theme applied
    // after the addon is published: here it is applied *before* activation.
    // The only cost is the import window on the very first activation of a
    // page load (10~200 ms) where the DOM renderer paints an opaque
    // background; afterwards loadWebglAddon hits the module cache and that
    // window is ~0. The gain is that the frame which activates does not flash
    // "transparent DOM -> opaque WebGL" (applying it afterwards would paint
    // once with the DOM theme in the same frame). Do not "fix" this back.
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
      // Dynamic import / addon constructor / loadAddon failed: the terminal has
      // to stay safely on DOM, and the theme has to be pulled back to DOM too
      // (the WebGL theme was applied before activation). The error is rethrown
      // so the controller maps it to DOM_FALLBACK; the controller records no
      // reason of its own, so the scene has to be logged here.
      logTerminalRender(this, 'webgl-activation-failed', { reason, error })
      console.error(error)
      // Mark this terminal so it never retries WebGL automatically: otherwise
      // every commit's reconcile would create a context again and flicker
      // between "apply WebGL theme, fail, pull the DOM theme back".
      this.webglActivationFailed = true
      // activateWebglAddon disposes the addon before rethrowing when
      // onActivated throws, so this.webglAddon can still point at a *released*
      // addon. The reference must be dropped here (same as
      // deactivateWebglRenderer) or applyTerminalTheme()'s default argument
      // (!!this.webglAddon) hands this terminal an opaque WebGL theme, the
      // diagnostics' state.webgl lies, and a later deactivateWebglRenderer
      // disposes the addon twice.
      this.webglAddon = null
      this.webglContextLossDisposable = null
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      notifyWebglFallback()
      throw error
    }
    if (!activated) {
      // The helper already released the stale addon; no reference may survive.
      logTerminalRender(this, 'webgl-activation-stale', { reason })
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      return false
    }
    invalidateWebglGlyphTextures(this.webglAddon)
    this.fitAndRefresh()
    return true
  },

  /**
   * Idempotent: the instance reference is dropped before the addon is
   * released, so concurrent or repeated calls (the controller does call this
   * more than once on some paths) are safe.
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
      // applyTerminalTheme already repaints the whole viewport; fitAndRefresh
      // below recomputes cols/rows for the DOM metrics.
      this.applyTerminalTheme(false, this.term, rendererTypes.dom)
      // Spec 8.3 step 5: after falling back, a visible terminal has to be fit
      // and refreshed, which is one of the mechanical guarantees behind "the
      // text is complete after the DOM recovery". fitAndRefresh carries its own
      // isElementVisible() guard, so the normal hide path (this runs for a
      // hidden terminal too) safely no-ops here.
      this.fitAndRefresh()
    }
    logTerminalRender(this, 'renderer-dispose', {
      reason,
      intentionalRelease: releaseContext
    })
  },

  /**
   * A real context loss: fall back to DOM first (without releasing the context
   * that is already gone), then trip the page-level breaker so the other
   * terminals explicitly release their own healthy contexts.
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
        // The breaker must not trip until this instance has fallen back with
        // releaseContext: false, and the order cannot be swapped: tripping is
        // broadcast synchronously, so calling it early would immediately run
        // this instance's own circuit listener (subscribeWebglCircuit in
        // terminal.jsx) -> reconcileRenderer('circuit tripped') -> target
        // becomes domFallback -> deactivateTo(..., releaseContext: true) ->
        // loseContext() on the context that is *already lost*, which is
        // exactly what releaseContext: false exists to avoid.
        // Only the terminal that actually trips the breaker notifies the user;
        // trip() returns false for the rest of the wave.
        if (tripWebglCircuit('unexpected context loss')) {
          notifyWebglFallback()
        }
      })
      // finally rethrows a failed fallback; nobody awaits this chain, so it
      // settles its own errors
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
        // Re-resolve instead of reusing the captured `rendererType`: a
        // terminal that got hidden or fell back inside this frame must not
        // have the opaque WebGL background written back over its DOM renderer.
        const current = resolveRendererThemeType(!!this.webglAddon, rendererTypes)
        this.term.options.theme = this.getRendererThemeConfig(this.props.themeConfig, current)
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
