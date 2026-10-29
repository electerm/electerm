const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = () => import('../../client/components/terminal/terminal-render-diagnostics.mjs')

function fixture () {
  return {
    props: { tab: { id: 'private-id', host: 'private-host' }, config: { rendererType: 'webGL' } },
    term: { rows: 24, cols: 80, buffer: 'private-output', _core: { _renderService: { _isPaused: true } } },
    domRef: { current: { clientWidth: 800, clientHeight: 400 } },
    rendererState: 'DOM_FALLBACK',
    rendererGeneration: 7,
    webglCircuitState: 'TRIPPED',
    webglAddon: {
      _renderer: {
        _gl: { isContextLost: () => false, canvas: { width: 1600, height: 800, isConnected: true } },
        _charAtlas: { pages: [{ version: 8 }], pageLayoutVersion: 2 },
        _glyphRenderer: { value: { _atlasTextures: [{ version: -1 }] } }
      }
    }
  }
}

test('diagnostics use anonymous stable IDs and serializable snapshots', async () => {
  const { logTerminalRender } = await load()
  const lines = []
  const owner = fixture()
  const emit = line => lines.push(line)
  logTerminalRender(owner, 'recover-request', { invalidated: true }, emit)
  logTerminalRender(owner, 'recover-settled', {}, emit)
  logTerminalRender(fixture(), 'recover-request', {}, emit)
  const records = lines.map(line => JSON.parse(line.slice('[terminal-render] '.length)))
  assert.equal(records[0].terminal, records[1].terminal)
  assert.notEqual(records[0].terminal, records[2].terminal)
  assert.ok(records[1].seq > records[0].seq)
  assert.equal(records[0].state.contextLost, false)
  assert.equal(records[0].state.renderPaused, true)
  assert.deepEqual(records[0].state.canvas, [1600, 800])
  assert.deepEqual(records[0].state.textureVersions, [-1])
  assert.equal(records[0].state.rendererState, 'DOM_FALLBACK')
  assert.equal(records[0].state.rendererGeneration, 7)
  assert.equal(records[0].state.circuitState, 'TRIPPED')
  assert.equal(records[0].invalidated, true)
  assert.equal(lines.some(line => line.includes('private-')), false)
})

test('diagnostics never serialize arbitrary details or error messages', async () => {
  const { logTerminalRender } = await load()
  let line
  logTerminalRender(fixture(), 'reload-failed', {
    error: new Error('password=secret'), output: 'private-output', host: 'private-host'
  }, text => { line = text })
  assert.ok(line.includes('Error'))
  assert.ok(!line.includes('secret'))
  assert.ok(!line.includes('private-'))
})

test('only serializes fixed lifecycle details', async () => {
  const { logTerminalRender } = await load()
  let line
  logTerminalRender(fixture(), 'dom-fallback-activated', {
    intentionalRelease: false,
    reason: 'unexpected context loss',
    host: 'private-host'
  }, text => { line = text })
  const record = JSON.parse(line.slice('[terminal-render] '.length))
  assert.equal(record.intentionalRelease, false)
  assert.equal(record.reason, 'unexpected context loss')
  assert.equal(line.includes('private-host'), false)
})

// M1 的要害是 'circuit reset' 漏加进 allowedReasons 就会被 fail-closed 静默丢掉
// （terminal.jsx 的 circuit 订阅在 event.type === 'reset' 时传这个新枚举），所以
// 这里两侧一起钉住：新枚举必须真的落进记录，且白名单没有被放宽成「任意字符串」。
test('keeps the circuit reset reason but rejects everything outside the set', async () => {
  const { logTerminalRender } = await load()
  const serialize = reason => {
    let line
    logTerminalRender(fixture(), 'renderer-state-change', { reason }, text => { line = text })
    return { line, record: JSON.parse(line.slice('[terminal-render] '.length)) }
  }

  const reset = serialize('circuit reset')
  assert.equal(reset.record.reason, 'circuit reset')

  // 近似串（尾空格）与无关数据都必须被丢掉，且不得出现在原始日志行里
  for (const rejected of ['circuit reset ', 'private-host']) {
    const { line, record } = serialize(rejected)
    assert.equal(record.reason, undefined)
    assert.equal(line.includes(rejected), false)
  }
})

test('only whitelisted renderer and circuit states are serialized', async () => {
  const { logTerminalRender } = await load()
  const owner = fixture()
  owner.rendererState = 'private-host'
  owner.webglCircuitState = { toString: () => 'private-host' }
  let line
  logTerminalRender(owner, 'renderer-state-change', {}, text => { line = text })
  const record = JSON.parse(line.slice('[terminal-render] '.length))
  assert.equal(record.state.rendererState, null)
  assert.equal(record.state.circuitState, null)
  assert.equal(line.includes('private-host'), false)
})

test('diagnostics tolerate DOM mode and missing xterm internals', async () => {
  const { logTerminalRender } = await load()
  let line
  assert.doesNotThrow(() => logTerminalRender({}, 'dispose', {}, text => { line = text }))
  const record = JSON.parse(line.slice('[terminal-render] '.length))
  assert.equal(record.state.contextLost, null)
  assert.equal(record.state.webgl, false)
})

test('broken private getters or console must not break recovery', async () => {
  const { logTerminalRender } = await load()
  const owner = fixture()
  Object.defineProperty(owner.webglAddon, '_renderer', { get () { throw new Error('private-secret') } })
  let line
  assert.doesNotThrow(() => logTerminalRender(owner, 'recover-request', {}, text => { line = text }))
  assert.ok(line.includes('snapshotUnavailable'))
  assert.ok(!line.includes('private-secret'))
  assert.doesNotThrow(() => logTerminalRender({}, 'dispose', {}, () => { throw new Error('console unavailable') }))
})
