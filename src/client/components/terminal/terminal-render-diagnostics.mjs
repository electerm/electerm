// The enum values come from the sibling modules instead of being restated
// here, so they cannot drift. Both are import-free, so there is no cycle.
import { rendererStates } from './terminal-render-lifecycle.mjs'
import { webglCircuitStates } from './terminal-webgl-circuit-breaker.mjs'

/**
 * Renderer diagnostics are a development aid, not telemetry.
 *
 * In a production build the default sink is a no-op and `logTerminalRender`
 * returns before it reads anything off the terminal, so nothing is serialised,
 * stringified or written to electron-log. A shipped app can turn the same
 * `[terminal-render] {...}` lines back on for a bug report by running
 * `localStorage.electermRenderDebug = '1'` and reloading.
 */
const debugStorageKey = 'electermRenderDebug'

function readDebugFlag () {
  try {
    return window.localStorage.getItem(debugStorageKey) === '1'
  } catch (_) {
    return false
  }
}

// Resolved once: flipping the flag takes a reload, which also keeps the hot
// path down to a single comparison.
const enabled = readDebugFlag()

// Identifiers are only valid for this page lifetime and never carry a real
// session id, host, command or terminal content.
const ids = new WeakMap()
let nextId = 0
let sequence = 0
const run = Date.now().toString(36)
const number = value => Number.isFinite(value) ? value : null
const flag = value => typeof value === 'boolean' ? value : null
// Only the fixed enums below are allowed through: a caller can never get an
// arbitrary string of its own into a record.
const allowedReasons = new Set([
  'initial',
  'component update',
  'tab visible',
  'tab hidden',
  'window focus',
  'renderer type change',
  'unexpected context loss',
  'circuit tripped',
  // Manual DOM->WebGL reset, passed in by terminal.jsx's circuit subscription
  // when event.type === 'reset'. It is kept apart from 'circuit tripped' on
  // purpose: a reset is a user action, a trip is a failure.
  // New reasons must be added here or the fail-closed check below drops the
  // field without a trace.
  'circuit reset',
  'unmount'
])
// Same for the state fields: a hostname or an error message stuffed into one
// of them still never reaches the log.
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
    // Enum strings only: no tab id, no host, no other caller data.
    rendererState: allowedRendererStates.has(owner.rendererState) ? owner.rendererState : null,
    // Read this as rough progress only: the lifecycle's setState() does not
    // call back when the state is unchanged while generation still increments,
    // so it can lag one or two decisions (see invalidate() in
    // terminal-render-lifecycle.mjs). rendererState / circuitState are always
    // accurate.
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
    // Version numbers only: no pixels are read and getError is never called,
    // so the log cannot consume a GL error or force a GPU sync.
    pageVersions: atlas?.pages?.slice(0, 32).map(page => number(page.version)) ?? [],
    textureVersions: textures?.slice(0, 32).map(texture => number(texture.version)) ?? []
  }
}

const consoleSink = line => console.info(line)

/**
 * @param {object} owner the terminal component instance
 * @param {string} event event name
 * @param {object} details only `reason`, `error`, `shouldFocus`,
 *   `invalidated` and `intentionalRelease` are read; everything else is dropped
 * @param {(line: string) => void} emit sink, overridable so tests can record
 *   without a build flag
 */
export function logTerminalRender (owner, event, details = {}, emit = consoleSink) {
  // A caller-supplied sink means "record this", which is how the unit tests
  // exercise the formatter on a non-dev build. The gate only applies to the
  // default console sink, so a production build exits here before taking any
  // snapshot of the terminal.
  if (emit === consoleSink && !enabled) return
  // Diagnostics must never break a recovery path. Whitelisted fields only:
  // props and errors are never expanded.
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
