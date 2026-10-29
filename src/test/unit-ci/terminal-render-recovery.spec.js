const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadModule = () => import('../../client/components/terminal/terminal-render-recovery.mjs')

describe('terminal render recovery', () => {
  test('refreshes all rows after the window regains focus', async () => {
    const { refreshTerminalAfterWindowFocus } = await loadModule()
    const calls = []
    const term = {
      rows: 24,
      focus: () => calls.push('focus'),
      refresh: (...args) => calls.push(['refresh', ...args])
    }

    refreshTerminalAfterWindowFocus(term)

    assert.deepEqual(calls, [
      'focus',
      ['refresh', 0, 23]
    ])
  })

  test('releases the WebGL context after disposing its listener and addon', async () => {
    const { disposeWebglAddon } = await loadModule()
    const calls = []
    const contextLossDisposable = {
      dispose: () => calls.push('listener')
    }
    const webglAddon = {
      _renderer: {
        _gl: {
          getExtension: name => {
            calls.push(['extension', name])
            return {
              loseContext: () => calls.push('context')
            }
          }
        }
      },
      dispose: () => calls.push('addon')
    }

    disposeWebglAddon({ webglAddon, contextLossDisposable })

    assert.deepEqual(calls, [
      'listener',
      'addon',
      ['extension', 'WEBGL_lose_context'],
      'context'
    ])
  })

  test('removes loss listener, disposes addon, then intentionally releases context', async () => {
    const { disposeWebglAddon } = await loadModule()
    const calls = []
    const webglAddon = {
      _renderer: {
        _gl: {
          getExtension: () => ({ loseContext: () => calls.push('context') })
        }
      },
      dispose: () => calls.push('addon')
    }
    disposeWebglAddon({
      webglAddon,
      contextLossDisposable: { dispose: () => calls.push('listener') },
      releaseContext: true
    })
    assert.deepEqual(calls, ['listener', 'addon', 'context'])
  })

  test('does not call loseContext when falling back from an already lost context', async () => {
    const { disposeWebglAddon } = await loadModule()
    let released = 0
    disposeWebglAddon({
      webglAddon: {
        _renderer: { _gl: { getExtension: () => ({ loseContext: () => released++ }) } },
        dispose: () => {}
      },
      releaseContext: false
    })
    assert.equal(released, 0)
  })

  test('does not attach a loss listener when the canvas is unavailable', async () => {
    const { attachContextLossListener } = await loadModule()

    assert.equal(attachContextLossListener({}, () => {}), null)
    assert.equal(attachContextLossListener(undefined, () => {}), null)
  })

  test('removes the loss listener when the addon is disposed', async () => {
    const { activateWebglAddon, disposeWebglAddon } = await loadModule()
    const handlers = new Map()
    const canvas = {
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: name => handlers.delete(name)
    }
    const WebglAddon = class {}
    let published
    await activateWebglAddon({
      loadWebglAddon: async () => WebglAddon,
      // xterm creates the renderer (and its canvas) during activate()
      term: {
        loadAddon: addon => {
          addon._renderer = { _gl: { canvas } }
        }
      },
      onContextLost: () => {},
      isCurrent: () => true,
      onActivated: renderer => { published = renderer }
    })

    assert.equal(handlers.has('webglcontextlost'), true)

    disposeWebglAddon(published)

    assert.equal(handlers.has('webglcontextlost'), false)
  })

  test('does not attach a loss listener before xterm activates the addon', async () => {
    const { activateWebglAddon, attachContextLossListener } = await loadModule()
    const handlers = new Map()
    const canvas = {
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: name => handlers.delete(name)
    }
    const WebglAddon = class {}
    let activatedDuringLoad = null
    const canvasWasReadyAtActivate = []
    // Attaching before loadAddon must be a no-op, because _renderer is absent.
    assert.equal(
      attachContextLossListener(new WebglAddon(), () => {}),
      null
    )
    await activateWebglAddon({
      loadWebglAddon: async () => WebglAddon,
      term: {
        loadAddon: addon => {
          activatedDuringLoad = addon
          canvasWasReadyAtActivate.push(!!addon._renderer)
          addon._renderer = { _gl: { canvas } }
        }
      },
      onContextLost: () => {},
      isCurrent: () => true
    })

    assert.deepEqual(canvasWasReadyAtActivate, [false])
    assert.ok(activatedDuringLoad)
    assert.equal(handlers.has('webglcontextlost'), true)
  })

  test('disposes an addon that becomes stale during xterm activation', async () => {
    const { activateWebglAddon } = await loadModule()
    const calls = []
    let current = true
    const WebglAddon = class {
      dispose () { calls.push('dispose') }
    }
    const result = await activateWebglAddon({
      loadWebglAddon: async () => WebglAddon,
      term: {
        loadAddon: addon => {
          addon._renderer = {
            _gl: {
              canvas: {
                addEventListener: () => {},
                removeEventListener: () => {}
              },
              getExtension: () => ({ loseContext: () => calls.push('lose') })
            }
          }
          current = false
        }
      },
      onContextLost: () => {},
      isCurrent: () => current,
      onActivated: () => calls.push('publish')
    })

    assert.equal(result, null)
    assert.deepEqual(calls, ['dispose', 'lose'])
  })

  test('disposes safely when WebGL private fields are unavailable', async () => {
    const { disposeWebglAddon } = await loadModule()
    let listenerDisposed = false
    let addonDisposed = false

    assert.doesNotThrow(() => disposeWebglAddon({
      webglAddon: { dispose: () => { addonDisposed = true } },
      contextLossDisposable: { dispose: () => { listenerDisposed = true } }
    }))
    assert.equal(listenerDisposed, true)
    assert.equal(addonDisposed, true)
  })

  test('still releases the context when disposal steps fail', async () => {
    const { disposeWebglAddon } = await loadModule()
    const errors = []
    let contextReleased = false
    const webglAddon = {
      _renderer: {
        _gl: {
          getExtension: () => ({
            loseContext: () => { contextReleased = true }
          })
        }
      },
      dispose: () => { throw new Error('addon dispose failed') }
    }
    const contextLossDisposable = {
      dispose: () => { throw new Error('listener dispose failed') }
    }

    assert.doesNotThrow(() => disposeWebglAddon({
      webglAddon,
      contextLossDisposable,
      onError: error => errors.push(error.message)
    }))
    assert.deepEqual(errors, [
      'listener dispose failed',
      'addon dispose failed'
    ])
    assert.equal(contextReleased, true)
  })

  test('does not create a WebGL addon after the terminal is disposed while loading', async () => {
    const { activateWebglAddon } = await loadModule()
    let resolveLoader
    const loader = new Promise(resolve => {
      resolveLoader = resolve
    })
    let current = true
    let constructorCalls = 0
    const loading = activateWebglAddon({
      loadWebglAddon: () => loader,
      term: { loadAddon: () => {} },
      onContextLost: () => {},
      isCurrent: () => current
    })

    current = false
    resolveLoader(class {
      constructor () {
        constructorCalls++
      }
    })

    assert.equal(await loading, null)
    assert.equal(constructorCalls, 0)
  })

  test('publishes the WebGL addon before activation completes', async () => {
    const { activateWebglAddon } = await loadModule()
    const calls = []
    const WebglAddon = class {}
    const loading = activateWebglAddon({
      loadWebglAddon: async () => WebglAddon,
      term: { loadAddon: () => calls.push('load') },
      onContextLost: () => {},
      isCurrent: () => true,
      onActivated: () => calls.push('publish')
    }).then(() => calls.push('resolved'))

    await loading

    assert.deepEqual(calls, ['load', 'publish', 'resolved'])
  })

  test('invalidates only the current WebGL renderer glyph textures', async () => {
    const { invalidateWebglGlyphTextures } = await loadModule()
    let invalidations = 0
    const webglAddon = {
      _renderer: {
        _glyphRenderer: {
          value: {
            invalidateAtlasTextures: () => invalidations++
          }
        }
      }
    }

    assert.equal(invalidateWebglGlyphTextures(webglAddon), true)
    assert.equal(invalidations, 1)
  })

  test('ignores missing WebGL glyph renderer private fields', async () => {
    const { invalidateWebglGlyphTextures } = await loadModule()

    assert.equal(invalidateWebglGlyphTextures(undefined), false)
    assert.equal(invalidateWebglGlyphTextures({}), false)
    assert.equal(invalidateWebglGlyphTextures({ _renderer: {} }), false)
  })

  test('recovers every unique visible terminal but focuses only the active one', async () => {
    const { recoverVisibleTerminals } = await loadModule()
    const calls = []
    const refs = new Map([
      ['term-a', { onWindowFocus: focus => calls.push(['a', focus]) }],
      ['term-b', { onWindowFocus: focus => calls.push(['b', focus]) }]
    ])

    const recovered = recoverVisibleTerminals(
      ['a', 'b', 'a', '', undefined],
      id => refs.get('term-' + id),
      'a'
    )

    assert.deepEqual(calls, [['a', true], ['b', false]])
    assert.equal(recovered, 2)
  })

  test('focus recovery reconciles only visible panes and focuses one terminal', async () => {
    const { recoverVisibleTerminals } = await loadModule()
    const calls = []
    const terminals = {
      active: {
        isElementVisible: () => true,
        onWindowFocus: shouldFocus => calls.push(['active', shouldFocus])
      },
      sibling: {
        isElementVisible: () => true,
        onWindowFocus: shouldFocus => calls.push(['sibling', shouldFocus])
      },
      hidden: {
        isElementVisible: () => false,
        onWindowFocus: shouldFocus => calls.push(['hidden', shouldFocus])
      }
    }
    assert.equal(recoverVisibleTerminals(
      ['active', 'sibling', 'hidden'],
      id => terminals[id],
      'active'
    ), 2)
    assert.deepEqual(calls, [['active', true], ['sibling', false]])
  })

  test('falls back to focusing the first terminal when no active ID is supplied', async () => {
    const { recoverVisibleTerminals } = await loadModule()
    const calls = []

    const recovered = recoverVisibleTerminals(
      ['first', 'second'],
      id => ({
        onWindowFocus: focus => calls.push([id, focus])
      })
    )

    assert.deepEqual(calls, [['first', true], ['second', false]])
    assert.equal(recovered, 2)
  })

  test('falls back to focusing terminals without a recovery hook', async () => {
    const { recoverVisibleTerminals } = await loadModule()
    let focused = 0

    const recovered = recoverVisibleTerminals(
      ['legacy'],
      () => ({ term: { focus: () => focused++ } })
    )

    assert.equal(focused, 1)
    assert.equal(recovered, 1)
  })

  test('skips hidden and closed panes even if their batch IDs remain set', async () => {
    const { recoverVisibleTerminals } = await loadModule()
    const calls = []
    const terminals = {
      visible: { isElementVisible: () => true, onWindowFocus: () => calls.push('visible') },
      hidden: { isElementVisible: () => false, onWindowFocus: () => calls.push('hidden') },
      closed: { onClose: true, onWindowFocus: () => calls.push('closed') }
    }
    assert.equal(recoverVisibleTerminals(
      ['visible', 'hidden', 'closed', 'missing'],
      id => terminals[id],
      'visible'
    ), 1)
    assert.deepEqual(calls, ['visible'])
  })

  test('refreshes an unfocused pane without moving keyboard focus', async () => {
    const { refreshTerminalAfterWindowFocus } = await loadModule()
    const calls = []
    refreshTerminalAfterWindowFocus({
      rows: 12,
      focus: () => calls.push('focus'),
      refresh: (...args) => calls.push(args)
    }, false)
    assert.deepEqual(calls, [[0, 11]])
  })

  test('observes raw context loss without changing browser recovery policy', async () => {
    const { attachContextLossListener } = await loadModule()
    const handlers = new Map()
    const canvas = {
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: name => handlers.delete(name)
    }
    let losses = 0
    let prevented = false
    const disposable = attachContextLossListener(
      { _renderer: { _gl: { canvas } } },
      () => { losses++ }
    )

    assert.deepEqual([...handlers.keys()], ['webglcontextlost'])
    handlers.get('webglcontextlost')({ preventDefault: () => { prevented = true } })
    assert.equal(losses, 1)
    assert.equal(prevented, false)
    disposable.dispose()
    assert.equal(handlers.size, 0)
  })
})
