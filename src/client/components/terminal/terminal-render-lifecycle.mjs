export const rendererStates = Object.freeze({
  dom: 'DOM',
  domHidden: 'DOM_HIDDEN',
  domFallback: 'DOM_FALLBACK',
  webglActivating: 'WEBGL_ACTIVATING',
  webgl: 'WEBGL_ACTIVE',
  disposed: 'DISPOSED'
})

/**
 * 页面级熔断与本终端「激活已经失败」都会禁止 WebGL。激活失败属于本终端的
 * 事实（这台机器上动态 import / addon 构造 / loadAddon 失败），所以在用户
 * 显式 DOM→WebGL 配置切换时随熔断一起复位。
 *
 * 保持零依赖纯函数：本模块不引入任何 import。
 */
export function resolveWebglAllowed (circuitAllowed, activationFailed) {
  return !!circuitAllowed && !activationFailed
}

export function getRendererTarget ({ disposed = false, rendererType, visible, webglAllowed }) {
  if (disposed) return rendererStates.disposed
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
    // generation 只在这里递增，而 setState() 在 state === next 时不会回调
    // onStateChange，所以诊断里的 rendererGeneration 可能比实际晚 1~2 个决策。
    // rendererState / webglCircuitState 始终准确；generation 只当「大致进度」读，
    // 不要拿它做等值断言。
    generation++
    clearFrame()
    // 只有激活 entry 会处于 started=false（排队中或等待释放收尾）。
    // 这种激活再也无法自行完成，就地结算，避免调用方永远 await；
    // 释放 entry 恒为 started=true，绝不在这里被提前结算
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
    // 必须先于 deactivate() 的同步执行体登记在飞状态：deactivate 内部的重入
    // reconcile 也要能看到这次释放，否则它会走「已激活」快速路径丢掉后续激活
    track(entry)

    const finish = () => {
      // 更晚的决策（新目标或 dispose）已作废这次释放，不能用旧目标覆盖它
      if (generation === expected) setState(target, reason)
    }

    let result
    try {
      // 同步调用：隐藏/降级必须在 reconcile 同一 tick 内真正开始释放
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

  // 帧回调里同步开始加载 addon（与 deactivate 一样早于任何 await 可见），
  // 只把结果 promise 交给 continuation 处理，帧回调本身不 await 它
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

  // 激活真正的副作用：先确认自己仍是当前决策，再推迟一帧启动 addon
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
          // 激活失败：只要这次决策没被作废，就收敛到「当前真实目标」。
          // 不能用 isCurrent()：owner 会在失败时置失败标记，getTarget() 那一刻
          // 已经是 domFallback，否则状态会停在 WEBGL_ACTIVATING。
          // 目标未移动（仍是 webgl）时必须落到 DOM_FALLBACK —— 安全终态是 DOM，
          // 失败路径绝不发布 WEBGL_ACTIVE，否则 reconcile 会命中「已激活」快速路径永不重试
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

  // 释放仍在飞行中时不得直接接上激活（否则释放的收尾会覆盖新状态），
  // 但也不能把释放本身串行化 —— 隐藏/降级必须同步释放，只有激活延后到它结算之后
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
