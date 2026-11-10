const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/terminal-webgl-circuit-breaker.mjs')

describe('terminal WebGL circuit breaker', () => {
  // Regression guard for the privacy boundary: window.__terminalWebglDiagnostic
  // is the only diagnostic surface hung off window, it may expose exactly two
  // fixed enum keys, and it must be frozen. A specifier with a query string
  // yields an *independent instance* of the module (Node caches by full URL),
  // so the `typeof window !== 'undefined'` branch at the module top runs again
  // and the assertions are not affected by the instance cached by the other
  // tests in this file. global.window is restored afterwards.
  test('exposes exactly two frozen enum fields on window.__terminalWebglDiagnostic', async () => {
    const hadWindow = Object.prototype.hasOwnProperty.call(global, 'window')
    const previousWindow = global.window
    global.window = {}
    try {
      await import(
        '../../client/components/terminal/terminal-webgl-circuit-breaker.mjs?privacy-boundary'
      )
      const diagnostic = global.window.__terminalWebglDiagnostic
      assert.ok(diagnostic, 'the module did not install window.__terminalWebglDiagnostic')
      assert.deepEqual(Object.keys(diagnostic), ['circuitState', 'generation'])
      assert.equal(Object.isFrozen(diagnostic), true)
      // Must be a fixed enum value, never caller data such as a hostname or an
      // error message
      assert.ok(
        ['HEALTHY', 'TRIPPED'].includes(diagnostic.circuitState),
        `circuitState must be a circuit enum value, got ${String(diagnostic.circuitState)}`
      )
      assert.equal(diagnostic.circuitState, 'HEALTHY')
      assert.equal(Number.isInteger(diagnostic.generation), true)
    } finally {
      if (hadWindow) {
        global.window = previousWindow
      } else {
        delete global.window
      }
    }
  })

  test('trips once for a wave of context losses', async () => {
    const { createWebglCircuitBreaker, webglCircuitStates } = await load()
    const events = []
    const circuit = createWebglCircuitBreaker()
    circuit.subscribe(event => events.push(event))

    assert.deepEqual(circuit.getSnapshot(), {
      state: webglCircuitStates.healthy,
      generation: 0,
      reason: null
    })
    assert.equal(circuit.trip('unexpected context loss'), true)
    assert.equal(circuit.trip('unexpected context loss'), false)
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'tripped')
    assert.equal(events[0].snapshot.state, webglCircuitStates.tripped)
  })

  test('isolates broken listeners and supports unsubscribe', async () => {
    const { createWebglCircuitBreaker } = await load()
    const errors = []
    const calls = []
    const circuit = createWebglCircuitBreaker({
      onListenerError: error => errors.push(error.message)
    })
    circuit.subscribe(() => { throw new Error('listener failed') })
    const disposable = circuit.subscribe(event => calls.push(event.type))

    circuit.trip('unexpected context loss')
    disposable.dispose()
    circuit.reset()

    // Both trip and reset broadcast, and the throwing listener stays
    // subscribed, so it reports twice
    assert.deepEqual(errors, ['listener failed', 'listener failed'])
    assert.deepEqual(calls, ['tripped'])
  })

  test('only an explicit reset re-enables WebGL', async () => {
    const { createWebglCircuitBreaker, webglCircuitStates } = await load()
    const circuit = createWebglCircuitBreaker()

    circuit.trip('unexpected context loss')
    assert.equal(circuit.isWebglAllowed(), false)
    assert.equal(circuit.reset(), true)
    assert.equal(circuit.reset(), false)
    assert.deepEqual(circuit.getSnapshot(), {
      state: webglCircuitStates.healthy,
      generation: 2,
      reason: null
    })
  })

  // The page-level breaker is shared: one DOM -> WebGL config switch makes every
  // live Term call reset. Only the first call really restores availability, the
  // rest must be idempotent no-ops, or every terminal bumps generation once.
  test('coalesces repeated reset calls from multiple terminal observers', async () => {
    const { createWebglCircuitBreaker } = await load()
    const circuit = createWebglCircuitBreaker()
    circuit.trip('unexpected context loss')
    assert.equal(circuit.reset(), true)
    assert.equal(circuit.reset(), false)
    assert.equal(circuit.getSnapshot().generation, 2)
  })
})
