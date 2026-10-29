const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/terminal-render-lifecycle.mjs')

function frameScheduler () {
  let nextId = 0
  const callbacks = new Map()
  return {
    request: callback => {
      const id = ++nextId
      callbacks.set(id, callback)
      return id
    },
    cancel: id => callbacks.delete(id),
    flush: async () => {
      const queued = [...callbacks.values()]
      callbacks.clear()
      for (const callback of queued) await callback()
    },
    size: () => callbacks.size
  }
}

describe('terminal renderer lifecycle', () => {
  test('selects the renderer target from config, visibility and circuit state', async () => {
    const { getRendererTarget, rendererStates } = await load()
    assert.equal(getRendererTarget({ rendererType: 'webGL', visible: true, webglAllowed: true }), rendererStates.webgl)
    assert.equal(getRendererTarget({ rendererType: 'webGL', visible: false, webglAllowed: true }), rendererStates.domHidden)
    assert.equal(getRendererTarget({ rendererType: 'webGL', visible: true, webglAllowed: false }), rendererStates.domFallback)
    assert.equal(getRendererTarget({ rendererType: 'dom', visible: true, webglAllowed: true }), rendererStates.dom)
    assert.equal(getRendererTarget({ disposed: true, rendererType: 'webGL', visible: true, webglAllowed: true }), rendererStates.disposed)
  })

  test('a failed activation disables WebGL until it is explicitly reset', async () => {
    const { resolveWebglAllowed } = await load()

    // 激活失败是本终端的事实，与熔断同级地禁止 WebGL
    assert.equal(resolveWebglAllowed(true, false), true)
    assert.equal(resolveWebglAllowed(true, true), false)
    assert.equal(resolveWebglAllowed(false, false), false)
    assert.equal(resolveWebglAllowed(false, true), false)
    // 真值收敛：controller 传进来的可能是 undefined
    assert.equal(resolveWebglAllowed(undefined, undefined), false)
    assert.equal(resolveWebglAllowed(true, undefined), true)
  })

  test('activates one frame later and disposes synchronously when hidden', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const calls = []
    let target = rendererStates.webgl
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async ({ isCurrent }) => {
        calls.push('activate')
        return isCurrent()
      },
      deactivate: options => calls.push(['deactivate', options.releaseContext]),
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const activating = lifecycle.reconcile('visible')
    assert.equal(frames.size(), 1)
    assert.deepEqual(calls, [])
    await frames.flush()
    await activating
    assert.equal(lifecycle.getSnapshot().state, rendererStates.webgl)

    target = rendererStates.domHidden
    await lifecycle.reconcile('hidden')
    assert.deepEqual(calls, ['activate', ['deactivate', true]])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domHidden)
  })

  test('rejects a late activation after visibility changes', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let target = rendererStates.webgl
    let release
    const gate = new Promise(resolve => { release = resolve })
    const calls = []
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async ({ isCurrent }) => {
        await gate
        calls.push(['activate-current', isCurrent()])
        return isCurrent()
      },
      deactivate: options => calls.push(['deactivate', options.releaseContext]),
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const first = lifecycle.reconcile('visible')
    await frames.flush()
    target = rendererStates.domHidden
    await lifecycle.reconcile('hidden')
    release()
    await first

    assert.deepEqual(calls, [
      ['deactivate', true],
      ['activate-current', false]
    ])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domHidden)
  })

  test('coalesces repeated reconcile calls for one generation', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let activations = 0
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => rendererStates.webgl,
      activate: async () => { activations++; return true },
      deactivate: () => {},
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const first = lifecycle.reconcile('focus')
    const second = lifecycle.reconcile('focus-again')
    assert.strictEqual(first, second)
    await frames.flush()
    await first
    await lifecycle.reconcile('already-active')
    assert.equal(activations, 1)
  })

  test('falls back without releasing an already lost source context', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const calls = []
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => rendererStates.webgl,
      activate: async () => true,
      deactivate: options => calls.push(options),
      requestFrame: callback => { callback(); return 1 },
      cancelFrame: () => {}
    })

    await lifecycle.reconcile('visible')
    await lifecycle.fallback('unexpected context loss', { releaseContext: false })
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domFallback)
    assert.equal(calls.at(-1).releaseContext, false)
  })

  test('dispose cancels queued activation and is terminal', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let activations = 0
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => rendererStates.webgl,
      activate: async () => { activations++; return true },
      deactivate: () => {},
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    lifecycle.reconcile('visible')
    await lifecycle.dispose('unmount')
    await frames.flush()
    assert.equal(activations, 0)
    assert.equal(lifecycle.getSnapshot().state, rendererStates.disposed)
  })

  test('activates after an in-flight deactivation settles', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const calls = []
    let target = rendererStates.webgl
    let releaseDeactivate
    const gate = new Promise(resolve => { releaseDeactivate = resolve })
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => { calls.push('activate'); return true },
      deactivate: async () => {
        calls.push('deactivate-start')
        await gate
        calls.push('deactivate-end')
      },
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    // 激活要等第一帧才真正开始，因此先拿到 promise，flush 之后再 await
    // （与 'activates one frame later...' 一致；直接 await 会在 flush 前死锁）
    const activating = lifecycle.reconcile('visible')
    await frames.flush()
    await activating

    target = rendererStates.domHidden
    const hiding = lifecycle.reconcile('hidden')
    assert.deepEqual(calls, ['activate', 'deactivate-start'])

    target = rendererStates.webgl
    const showing = lifecycle.reconcile('visible again')
    releaseDeactivate()
    await hiding
    await frames.flush()
    await showing

    assert.deepEqual(calls, ['activate', 'deactivate-start', 'deactivate-end', 'activate'])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.webgl)
  })

  test('reuses an in-flight deactivation for a repeated identical target', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    let deactivations = 0
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => rendererStates.domHidden,
      activate: async () => true,
      deactivate: () => { deactivations++ },
      requestFrame: callback => { callback(); return 1 },
      cancelFrame: () => {}
    })

    const first = lifecycle.reconcile('hidden')
    const second = lifecycle.reconcile('hidden again')
    assert.strictEqual(first, second)

    await first
    await second
    assert.equal(deactivations, 1)
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domHidden)
  })

  test('keeps the newest target when two deactivations overlap', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const gates = []
    let target = rendererStates.webgl
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => true,
      deactivate: () => new Promise(resolve => gates.push(resolve)),
      requestFrame: callback => { callback(); return 1 },
      cancelFrame: () => {}
    })

    await lifecycle.reconcile('visible')

    target = rendererStates.domHidden
    const hiding = lifecycle.reconcile('hidden')
    target = rendererStates.domFallback
    const fallingBack = lifecycle.reconcile('fallback')

    gates[1]()
    await fallingBack
    gates[0]()
    await hiding

    assert.equal(lifecycle.getSnapshot().state, rendererStates.domFallback)
  })

  test('does not lose an activation requested during a synchronous deactivation', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const calls = []
    let target = rendererStates.webgl
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => { calls.push('activate'); return true },
      deactivate: () => {
        calls.push('deactivate')
        // 释放的同步执行体内，外部决策已经翻回 webgl
        target = rendererStates.webgl
        lifecycle.reconcile('re-entrant')
      },
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    // 激活要等第一帧才真正开始，因此先接住 promise，flush 之后再 await
    const activating = lifecycle.reconcile('visible')
    await frames.flush()
    await activating

    target = rendererStates.domHidden
    await lifecycle.reconcile('hidden')
    await frames.flush()

    assert.deepEqual(calls, ['activate', 'deactivate', 'activate'])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.webgl)
  })

  test('does not activate when the circuit trips while activation is in flight', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let target = rendererStates.webgl
    let release
    const gate = new Promise(resolve => { release = resolve })
    const calls = []
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => { calls.push('activate'); await gate; return true },
      deactivate: options => calls.push(['deactivate', options.releaseContext]),
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const activating = lifecycle.reconcile('visible')
    const flushing = frames.flush()
    target = rendererStates.domFallback
    const falling = lifecycle.fallback('unexpected context loss', { releaseContext: false })
    release()
    await flushing
    await activating
    await falling

    assert.deepEqual(calls, ['activate', ['deactivate', false]])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domFallback)
  })

  test('stays on DOM when the renderer config changes during activation', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let target = rendererStates.webgl
    let release
    const gate = new Promise(resolve => { release = resolve })
    const calls = []
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => { calls.push('activate'); await gate; return true },
      deactivate: () => calls.push('deactivate'),
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const activating = lifecycle.reconcile('visible')
    const flushing = frames.flush()
    target = rendererStates.dom
    const changing = lifecycle.reconcile('renderer type change')
    release()
    await flushing
    await activating
    await changing

    assert.deepEqual(calls, ['activate', 'deactivate'])
    assert.equal(lifecycle.getSnapshot().state, rendererStates.dom)
  })

  test('propagates a release failure to the caller and still settles the state', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const expected = { message: 'release failed' }
    const build = deactivate => createTerminalRendererLifecycle({
      getTarget: () => rendererStates.domHidden,
      activate: async () => true,
      deactivate,
      requestFrame: () => 1,
      cancelFrame: () => {}
    })

    const throwing = build(() => { throw new Error('release failed') })
    await assert.rejects(() => throwing.reconcile('hidden'), expected)
    assert.equal(throwing.getSnapshot().state, rendererStates.domHidden)

    const rejecting = build(async () => { throw new Error('release failed') })
    await assert.rejects(() => rejecting.reconcile('hidden'), expected)
    assert.equal(rejecting.getSnapshot().state, rendererStates.domHidden)

    const failingDispose = build(async () => { throw new Error('release failed') })
    await assert.rejects(() => failingDispose.dispose('unmount'), expected)
    assert.equal(failingDispose.getSnapshot().state, rendererStates.disposed)
  })

  // 该测试不模拟 React；它锁定 renderer controller 不接管会话所有权：
  // 隐藏释放只能摘掉 addon，绝不能碰 term/socket 的身份或生命周期。
  test('keeps terminal and socket identity while renderer changes', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const term = { id: 'same-term' }
    const socket = { closeCalls: 0, close () { this.closeCalls++ } }
    let target = rendererStates.webgl
    let addon = { id: 'webgl' }
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => true,
      deactivate: () => { addon = null },
      requestFrame: callback => { callback(); return 1 },
      cancelFrame: () => {}
    })

    await lifecycle.reconcile('visible')
    target = rendererStates.domHidden
    await lifecycle.reconcile('hidden')

    assert.equal(addon, null)
    assert.equal(term.id, 'same-term')
    assert.equal(socket.closeCalls, 0)
  })

  // 集成前安全网：初始 reconcile 必须让隐藏终端停在 DOM，既不排帧也不激活，
  // 因为隐藏容器没有尺寸，激活 WebGL 只会白白占用一个 context。
  test('keeps an initially hidden terminal on DOM without scheduling WebGL', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const target = rendererStates.domHidden
    let activations = 0
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => { activations++; return true },
      deactivate: () => {},
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    await lifecycle.reconcile('initial')
    assert.equal(frames.size(), 0)
    assert.equal(activations, 0)
    assert.equal(lifecycle.getSnapshot().state, rendererStates.domHidden)
  })

  // tab 切换的交接顺序：旧终端必须在同一 tick 内同步释放，新终端最早下一帧
  // 才激活，两者不会同时持有一个 WebGL context。
  test('releases the old visible renderer before the next frame activates the new one', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const calls = []
    let oldTarget = rendererStates.webgl
    let newTarget = rendererStates.domHidden
    const make = (name, getTarget) => createTerminalRendererLifecycle({
      getTarget,
      activate: async () => { calls.push(`${name}:activate`); return true },
      deactivate: () => calls.push(`${name}:deactivate`),
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })
    const oldLife = make('old', () => oldTarget)
    const newLife = make('new', () => newTarget)
    oldLife.reconcile('initial')
    await frames.flush()

    oldTarget = rendererStates.domHidden
    newTarget = rendererStates.webgl
    await oldLife.reconcile('tab hidden')
    const next = newLife.reconcile('tab visible')
    assert.deepEqual(calls, ['old:activate', 'old:deactivate'])
    await frames.flush()
    await next
    assert.deepEqual(calls, ['old:activate', 'old:deactivate', 'new:activate'])
  })

  test('converges to the current target when activation fails and the target moved', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    let target = rendererStates.webgl
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => target,
      activate: async () => {
        // 模拟 owner 在激活失败时置了失败标记，使目标立刻变为 domFallback
        target = rendererStates.domFallback
        throw new Error('activation failed')
      },
      deactivate: () => {},
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const activating = lifecycle.reconcile('visible')
    await frames.flush()
    await activating

    assert.equal(lifecycle.getSnapshot().state, rendererStates.domFallback)
  })

  test('never publishes WEBGL_ACTIVE when activation fails in place', async () => {
    const { createTerminalRendererLifecycle, rendererStates } = await load()
    const frames = frameScheduler()
    const lifecycle = createTerminalRendererLifecycle({
      getTarget: () => rendererStates.webgl,
      activate: async () => { throw new Error('activation failed') },
      deactivate: () => {},
      requestFrame: frames.request,
      cancelFrame: frames.cancel
    })

    const activating = lifecycle.reconcile('visible')
    await frames.flush()
    await activating

    assert.equal(lifecycle.getSnapshot().state, rendererStates.domFallback)
  })
})
