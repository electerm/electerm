export const rendererStates = Object.freeze({
  dom: 'DOM',
  domHidden: 'DOM_HIDDEN',
  domFallback: 'DOM_FALLBACK',
  webglActivating: 'WEBGL_ACTIVATING',
  webgl: 'WEBGL_ACTIVE',
  disposed: 'DISPOSED'
})

/**
 * Two separate facts can forbid WebGL: the page-level circuit breaker, and this
 * terminal having already failed to activate. The second one is local evidence
 * (a dynamic import / addon constructor / loadAddon failure on this machine),
 * so it is reset together with the breaker when the user explicitly switches
 * the renderer setting from DOM to WebGL.
 *
 * Kept a pure zero-dependency function: this module imports nothing.
 */
export function resolveWebglAllowed (circuitAllowed, activationFailed) {
  return !!circuitAllowed && !activationFailed
}

export function getRendererTarget ({ disposed = false, rendererType, visible, webglAllowed }) {
  if (disposed) return rendererStates.disposed
  // Matches rendererTypes.webGL in src/client/common/constants.js. Kept a
  // literal because this module deliberately imports nothing.
  if (rendererType !== 'webGL') return rendererStates.dom
  if (!webglAllowed) return rendererStates.domFallback
  return visible ? rendererStates.webgl : rendererStates.domHidden
}

export function createTerminalRendererLifecycle ({
  getTarget,
  activate,
  deactivate,
  requestFrame,
  cancelFrame,
  onStateChange = () => {}
}) {
  let state = rendererStates.dom
  let generation = 0
  let frame = null
  let pending = null
  let disposed = false

  function getSnapshot () {
    return { state, generation }
  }

  function setState (next, reason) {
    if (state === next) return
    state = next
    onStateChange({ ...getSnapshot(), reason })
  }

  function clearFrame () {
    if (frame === null) return
    cancelFrame(frame)
    frame = null
  }

  function release (entry) {
    if (pending === entry) pending = null
  }

  function track (entry) {
    pending = entry
    entry.promise.then(() => release(entry), () => release(entry))
  }

  function invalidate () {
    // generation only ever increments here, while setState() does not call
    // onStateChange when the state is unchanged, so the diagnostics'
    // rendererGeneration can lag one or two decisions. rendererState /
    // webglCircuitState are always accurate; read generation as rough progress
    // only, never assert equality on it.
    generation++
    clearFrame()
    // Only an activation entry can be in started=false (queued, or waiting for
    // a release to settle). Such an activation can never complete on its own,
    // so it is settled here instead of leaving its caller awaiting forever.
    // A release entry is always started=true and must never be settled early.
    const entry = pending
    if (entry !== null && !entry.started) {
      release(entry)
      entry.settle(state)
    }
  }

  function isCurrent (expected = generation) {
    return !disposed && expected === generation && getTarget() === rendererStates.webgl
  }

  function finishActivation (entry) {
    release(entry)
    entry.settle(state)
  }

  function deferred () {
    let resolveEntry
    let rejectEntry
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve
      rejectEntry = reject
    })
    return { promise, resolve: resolveEntry, reject: rejectEntry }
  }

  function createDeactivationEntry (target) {
    const { promise, resolve, reject } = deferred()
    return { kind: 'deactivate', target, promise, settle: resolve, reject, started: true }
  }

  function deactivateTo (target, reason, releaseContext) {
    invalidate()
    const expected = generation
    const entry = createDeactivationEntry(target)
    // The in-flight entry has to be registered before deactivate()'s
    // synchronous body runs: a re-entrant reconcile from inside deactivate
    // must see this release, or it takes the "already active" fast path and
    // drops the activation that follows.
    track(entry)

    const finish = () => {
      // A later decision (new target, or dispose) has already invalidated this
      // release, so the old target must not overwrite it.
      if (generation === expected) setState(target, reason)
    }

    let result
    try {
      // Synchronous call: hiding / falling back must really start releasing in
      // the same tick as the reconcile.
      result = deactivate({ reason, releaseContext })
    } catch (error) {
      result = Promise.reject(error)
    }
    Promise.resolve(result).then(
      () => {
        finish()
        entry.settle()
      },
      error => {
        finish()
        entry.reject(error)
      }
    )

    return entry.promise
  }

  function createActivationEntry () {
    const { promise, resolve } = deferred()
    return { kind: 'activate', promise, settle: resolve, started: false }
  }

  // The frame callback starts loading the addon synchronously (visible before
  // any await, like deactivate) and hands the resulting promise to the
  // continuation; the frame callback itself never awaits it.
  function callActivate (expected, reason) {
    try {
      return Promise.resolve(activate({
        reason,
        generation: expected,
        isCurrent: () => isCurrent(expected)
      }))
    } catch (error) {
      return Promise.reject(error)
    }
  }

  // The real side effect of an activation: confirm this is still the current
  // decision, then defer starting the addon by one frame.
  function runActivation (entry, reason) {
    if (pending !== entry || disposed || getTarget() !== rendererStates.webgl) {
      release(entry)
      entry.settle(state)
      return
    }
    setState(rendererStates.webglActivating, reason)
    const expected = generation
    let queued = true
    const token = requestFrame(() => {
      queued = false
      frame = null
      if (disposed) {
        finishActivation(entry)
        return
      }
      if (!isCurrent(expected)) {
        setState(getTarget(), reason)
        finishActivation(entry)
        return
      }
      entry.started = true
      callActivate(expected, reason).then(
        activated => {
          if (isCurrent(expected)) setState(activated ? rendererStates.webgl : rendererStates.domFallback, reason)
          finishActivation(entry)
        },
        () => {
          // Activation failed: as long as this decision was not invalidated,
          // converge on the real current target. isCurrent() cannot be used
          // here: the owner sets its failure flag before rejecting, so
          // getTarget() already reports domFallback and the state would
          // otherwise be stuck on WEBGL_ACTIVATING.
          // When the target has not moved (still webgl) the state must land on
          // DOM_FALLBACK - DOM is the safe terminal state and the failure path
          // must never publish WEBGL_ACTIVE, or reconcile hits the "already
          // active" fast path and never retries.
          if (!disposed && expected === generation) {
            const target = getTarget()
            setState(
              target === rendererStates.webgl ? rendererStates.domFallback : target,
              reason
            )
          }
          finishActivation(entry)
        }
      )
    })
    // requestFrame may invoke the callback synchronously, in which case that
    // frame already cleared itself and must not be registered as pending
    if (queued) frame = token
  }

  function startActivation (reason) {
    const entry = createActivationEntry()
    track(entry)
    runActivation(entry, reason)
    return entry.promise
  }

  // An activation must not be chained straight onto an in-flight release (its
  // tail would overwrite the new state), but the release itself must not be
  // serialised either: hiding / falling back has to release synchronously.
  // Only the activation waits for it to settle.
  function chainActivationAfter (blocker, reason) {
    const entry = createActivationEntry()
    track(entry)
    const activateNext = () => runActivation(entry, reason)
    blocker.promise.then(activateNext, activateNext)
    return entry.promise
  }

  function reconcile (reason) {
    if (disposed) return Promise.resolve(rendererStates.disposed)
    const target = getTarget()
    if (target !== rendererStates.webgl) {
      if (pending === null && state === target && frame === null) return Promise.resolve(target)
      if (pending !== null && pending.kind === 'deactivate' && pending.target === target) return pending.promise
      return deactivateTo(target, reason, true)
    }
    if (pending !== null) {
      return pending.kind === 'deactivate'
        ? chainActivationAfter(pending, reason)
        : pending.promise
    }
    if (state === rendererStates.webgl) return Promise.resolve(state)

    return startActivation(reason)
  }

  function fallback (reason, { releaseContext = false } = {}) {
    if (disposed) return Promise.resolve(rendererStates.disposed)
    return deactivateTo(rendererStates.domFallback, reason, releaseContext)
  }

  function dispose (reason = 'unmount') {
    if (disposed) return Promise.resolve(rendererStates.disposed)
    disposed = true
    invalidate()
    return (async () => {
      try {
        await deactivate({ reason, releaseContext: true })
      } finally {
        setState(rendererStates.disposed, reason)
      }
    })()
  }

  return {
    reconcile,
    fallback,
    dispose,
    getSnapshot,
    isCurrent
  }
}
