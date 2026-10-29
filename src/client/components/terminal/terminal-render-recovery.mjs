export function refreshTerminalAfterWindowFocus (term, shouldFocus = true) {
  if (!term) {
    return
  }
  if (shouldFocus) {
    term.focus()
  }
  term.refresh(0, term.rows - 1)
}

export function disposeWebglAddon ({
  webglAddon,
  contextLossDisposable,
  releaseContext = true,
  onError = () => {}
} = {}) {
  const gl = webglAddon?._renderer?._gl
  const safely = operation => {
    try {
      operation()
    } catch (error) {
      onError(error)
    }
  }
  safely(() => contextLossDisposable?.dispose?.())
  safely(() => webglAddon?.dispose?.())
  if (releaseContext) {
    safely(() => gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.())
  }
}

/**
 * Watches the raw `webglcontextlost` event on xterm's canvas. The locked xterm
 * version already registers its own `webglcontextlost` listener (which calls
 * preventDefault) and its 3s onContextLoss timer when the renderer is
 * constructed; this listener deliberately does not replace or reimplement that
 * upstream policy — it exists so electerm learns about the loss synchronously.
 * On loss we dispose the addon in the same tick, and that dispose clears
 * xterm's timer and removes its listener. A restored context can still leave
 * the renderer permanently black, so electerm tears the addon down and rebuilds
 * the terminal instead of waiting for a restore.
 *
 * xterm exposes no public loss event, so this reads the same private
 * `_renderer._gl` the upstream context-release fix relies on.
 */
export function attachContextLossListener (webglAddon, onLost) {
  const canvas = webglAddon?._renderer?._gl?.canvas
  if (!canvas?.addEventListener) {
    return null
  }
  const handler = event => onLost?.(event)
  canvas.addEventListener('webglcontextlost', handler)
  return {
    dispose: () => canvas.removeEventListener('webglcontextlost', handler)
  }
}

export async function activateWebglAddon ({
  loadWebglAddon,
  term,
  onContextLost,
  isCurrent,
  onActivated,
  onError
}) {
  const WebglAddon = await loadWebglAddon()
  if (!isCurrent()) {
    return null
  }
  const webglAddon = new WebglAddon()
  let contextLossDisposable
  try {
    term.loadAddon(webglAddon)
    contextLossDisposable = attachContextLossListener(webglAddon, onContextLost)
    if (!isCurrent()) {
      disposeWebglAddon({ webglAddon, contextLossDisposable, onError })
      return null
    }
    const result = { webglAddon, contextLossDisposable }
    onActivated?.(result)
    return result
  } catch (error) {
    disposeWebglAddon({ webglAddon, contextLossDisposable, onError })
    throw error
  }
}

export function invalidateWebglGlyphTextures (webglAddon) {
  const invalidate = webglAddon?._renderer?._glyphRenderer?.value
    ?.invalidateAtlasTextures
  if (typeof invalidate !== 'function') {
    return false
  }
  invalidate.call(webglAddon._renderer._glyphRenderer.value)
  return true
}

export function recoverVisibleTerminals (terminalIds, getTerminal, activeTerminalId) {
  let recovered = 0
  const ids = [...new Set(terminalIds.filter(Boolean))]
  const focusId = activeTerminalId || ids[0]
  for (const id of ids) {
    const terminal = getTerminal(id)
    if (!terminal || terminal.onClose || terminal.isElementVisible?.() === false) {
      continue
    }
    const shouldFocus = id === focusId
    if (typeof terminal.onWindowFocus === 'function') {
      terminal.onWindowFocus(shouldFocus)
    } else if (shouldFocus) {
      terminal.term?.focus?.()
    }
    recovered++
  }
  return recovered
}
