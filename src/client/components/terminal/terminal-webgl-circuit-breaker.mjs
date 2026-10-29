export const webglCircuitStates = Object.freeze({
  healthy: 'HEALTHY',
  tripped: 'TRIPPED'
})

export function createWebglCircuitBreaker ({ onListenerError = () => {} } = {}) {
  let state = webglCircuitStates.healthy
  let generation = 0
  let reason = null
  const listeners = new Set()

  function getSnapshot () {
    return { state, generation, reason }
  }

  function emit (type) {
    const event = { type, snapshot: getSnapshot() }
    for (const listener of [...listeners]) {
      try {
        listener(event)
      } catch (error) {
        onListenerError(error)
      }
    }
  }

  return {
    getSnapshot,
    isWebglAllowed: () => state === webglCircuitStates.healthy,
    trip (nextReason = 'unexpected context loss') {
      if (state === webglCircuitStates.tripped) return false
      state = webglCircuitStates.tripped
      generation++
      reason = nextReason
      emit('tripped')
      return true
    },
    reset () {
      if (state === webglCircuitStates.healthy) return false
      state = webglCircuitStates.healthy
      generation++
      reason = null
      emit('reset')
      return true
    },
    subscribe (listener) {
      listeners.add(listener)
      return {
        dispose: () => listeners.delete(listener)
      }
    }
  }
}

const webglCircuit = createWebglCircuitBreaker({
  onListenerError: error => console.error('WebGL circuit listener failed', error)
})

export const getWebglCircuitSnapshot = () => webglCircuit.getSnapshot()
export const isWebglAllowed = () => webglCircuit.isWebglAllowed()
export const tripWebglCircuit = reason => webglCircuit.trip(reason)
export const resetWebglCircuit = () => webglCircuit.reset()
export const subscribeWebglCircuit = listener => webglCircuit.subscribe(listener)

if (typeof window !== 'undefined') {
  const diagnostic = {}
  Object.defineProperties(diagnostic, {
    circuitState: {
      enumerable: true,
      get: () => getWebglCircuitSnapshot().state
    },
    generation: {
      enumerable: true,
      get: () => getWebglCircuitSnapshot().generation
    }
  })
  window.__terminalWebglDiagnostic = Object.freeze(diagnostic)
}
