const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/terminal-webgl-circuit-breaker.mjs')

describe('terminal WebGL circuit breaker', () => {
  // 隐私边界的回归防护：window.__terminalWebglDiagnostic 是唯一挂到 window 上的
  // 诊断出口，只允许暴露两个固定枚举键且必须冻结。用带 query 的 specifier 取得
  // 该模块的**独立实例**（Node 按完整 URL 缓存模块），让模块顶层的
  // `typeof window !== 'undefined'` 分支重新执行一次，断言就不受本文件其他用例
  // 已缓存模块的影响；测试结束后恢复 global.window。
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
      // 必须是固定枚举值，绝不能是主机名/错误信息等调用方数据
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

    // trip 与 reset 都会广播，抛错的 listener 仍保持订阅，因此报告两次
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

  // 页面级熔断是共享的：一次 DOM→WebGL 配置切换会让每个存活的 Term 都调用
  // reset。只有第一次真正恢复可用性，后续调用必须是幂等的 no-op，
  // 否则每个终端都会把 generation 推高一次。
  test('coalesces repeated reset calls from multiple terminal observers', async () => {
    const { createWebglCircuitBreaker } = await load()
    const circuit = createWebglCircuitBreaker()
    circuit.trip('unexpected context loss')
    assert.equal(circuit.reset(), true)
    assert.equal(circuit.reset(), false)
    assert.equal(circuit.getSnapshot().generation, 2)
  })
})
