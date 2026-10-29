// 枚举真值来源与兄弟模块共享，避免日后取值漂移；两者均零 import，无循环依赖。
import { rendererStates } from './terminal-render-lifecycle.mjs'
import { webglCircuitStates } from './terminal-webgl-circuit-breaker.mjs'

// 编号仅在本次页面生命周期有效，不记录真实会话 ID、主机、命令或终端内容。
const ids = new WeakMap()
let nextId = 0
let sequence = 0
const run = Date.now().toString(36)
const number = value => Number.isFinite(value) ? value : null
const flag = value => typeof value === 'boolean' ? value : null
// 只放行固定枚举，绝不写入调用方传入的任意字符串。
const allowedReasons = new Set([
  'initial',
  'component update',
  'tab visible',
  'tab hidden',
  'window focus',
  'renderer type change',
  'unexpected context loss',
  'circuit tripped',
  // 手动 DOM→WebGL 复位（terminal.jsx 的 circuit 订阅在 event.type === 'reset'
  // 时传入）。与 'circuit tripped' 必须分开：复位是用户操作，不是熔断。
  // 新增固定枚举时务必加进这里，否则 fail-closed 会静默丢掉 reason 字段。
  'circuit reset',
  'unmount'
])
// 同样只放行固定枚举：即使调用方把主机名或错误信息塞进这些字段也不会落盘。
const allowedRendererStates = new Set(Object.values(rendererStates))
const allowedCircuitStates = new Set(Object.values(webglCircuitStates))

function idFor (object) {
  if (!object || typeof object !== 'object') return null
  if (!ids.has(object)) ids.set(object, ++nextId)
  return ids.get(object)
}

function snapshot (owner) {
  const term = owner.term
  const renderer = owner.webglAddon?._renderer
  const gl = renderer?._gl
  const canvas = gl?.canvas
  const atlas = renderer?._charAtlas
  const textures = renderer?._glyphRenderer?.value?._atlasTextures
  const service = term?._core?._renderService
  const element = owner.domRef?.current
  const doc = element?.ownerDocument
  const win = doc?.defaultView
  return {
    closed: !!owner.onClose,
    // 仅固定枚举字符串，不记录 tab id、主机或其他调用方数据。
    rendererState: allowedRendererStates.has(owner.rendererState) ? owner.rendererState : null,
    // 只当「大致进度」读：lifecycle 的 setState() 在 state 未变时不回调，
    // 而 generation 照常递增，所以这里可能滞后 1~2 个决策
    // （见 terminal-render-lifecycle.mjs 的 invalidate()）。
    // rendererState / circuitState 始终准确。
    rendererGeneration: number(owner.rendererGeneration),
    circuitState: allowedCircuitStates.has(owner.webglCircuitState) ? owner.webglCircuitState : null,
    active: owner.props?.tab?.id != null
      ? owner.props.tab.id === owner.props.activeTabId
      : null,
    visible: !!(element?.clientWidth > 0 && element?.clientHeight > 0),
    documentHidden: flag(doc?.hidden),
    documentFocused: doc?.hasFocus?.() ?? null,
    dpr: number(win?.devicePixelRatio),
    rows: number(term?.rows),
    cols: number(term?.cols),
    container: [number(element?.clientWidth), number(element?.clientHeight)],
    webgl: !!renderer,
    rendererMatches: renderer && service?._renderer ? service._renderer.value === renderer : null,
    rendererDpr: number(renderer?._devicePixelRatio),
    context: idFor(gl),
    contextLost: gl?.isContextLost?.() ?? null,
    canvas: [number(canvas?.width), number(canvas?.height)],
    canvasConnected: flag(canvas?.isConnected),
    renderPaused: flag(service?._isPaused),
    needsFullRefresh: flag(service?._needsFullRefresh),
    synchronizedOutput: flag(term?._core?.coreService?.decPrivateModes?.synchronizedOutput),
    atlas: idFor(atlas),
    atlasLayoutVersion: number(atlas?.pageLayoutVersion),
    atlasPages: number(atlas?.pages?.length),
    // 只读版本号，不读取像素、不调用 getError，避免消费 GL 错误或触发 GPU 同步。
    pageVersions: atlas?.pages?.slice(0, 32).map(page => number(page.version)) ?? [],
    textureVersions: textures?.slice(0, 32).map(texture => number(texture.version)) ?? []
  }
}

export function logTerminalRender (owner, event, details = {}, emit = line => console.info(line)) {
  // 诊断失败不能中断恢复流程。只序列化白名单字段，绝不展开 props/error。
  try {
    let state
    try {
      state = snapshot(owner)
    } catch (_) {
      state = { snapshotUnavailable: true }
    }
    const record = {
      schema: 1,
      build: 'glyph-recovery-diag-1',
      run,
      seq: ++sequence,
      time: new Date().toISOString(),
      terminal: idFor(owner),
      event,
      state
    }
    for (const key of ['shouldFocus', 'invalidated', 'intentionalRelease']) {
      if (typeof details[key] === 'boolean') record[key] = details[key]
    }
    if (details.error) {
      record.errorType = ['TypeError', 'RangeError', 'ReferenceError', 'Error'].includes(details.error.name)
        ? details.error.name
        : 'Error'
    }
    if (allowedReasons.has(details.reason)) {
      record.reason = details.reason
    }
    emit('[terminal-render] ' + JSON.stringify(record))
  } catch (_) {}
}
