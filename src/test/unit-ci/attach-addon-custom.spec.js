const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = global.window || { xtermAddons: {} }
global.window.xtermAddons = global.window.xtermAddons || {}

const loadModule = () => import('../../client/components/terminal/attach-addon-custom.js')

describe('terminal output truncation', () => {
  test('removes cursor operations after safe leading ANSI sequences', async () => {
    const { stripLeadingCursorOps } = await loadModule()
    const esc = String.fromCharCode(27)
    const safePrefix = `${esc}[?25l${esc}[31m${esc}[2J`
    const input = `${safePrefix}${esc}[50A${esc}8${esc}[uhello`

    assert.equal(stripLeadingCursorOps(input), `${safePrefix}hello`)
  })

  test('keeps a single oversized chunk within the character cap', async () => {
    const { truncateTerminalOutput } = await loadModule()
    const maxChars = 96
    const input = `old line\n${'x'.repeat(300)}`
    const result = truncateTerminalOutput(input, maxChars)

    assert.ok(result.output.length <= maxChars)
    assert.match(result.output, /output truncated/)
    assert.ok(result.output.endsWith('x'.repeat(20)))
    assert.ok(result.dropped > 0)
  })

  test('does not retain a partial multi-byte ESC sequence', async () => {
    const { truncateTerminalOutput } = await loadModule()
    const esc = String.fromCharCode(27)
    const maxChars = 80
    const input = `${'x'.repeat(200)}${esc}${'('.repeat(100)}Btail`
    const result = truncateTerminalOutput(input, maxChars)

    assert.ok(result.output.length <= maxChars)
    assert.match(result.output, /output truncated/)
    assert.ok(result.output.endsWith('tail'))
    assert.ok(!result.output.includes('(B'))
  })

  test('does not retain a partial ANSI string control sequence', async () => {
    const { truncateTerminalOutput } = await loadModule()
    const esc = String.fromCharCode(27)
    const bel = String.fromCharCode(7)
    const maxChars = 80
    const input = `${'x'.repeat(200)}${esc}]0;${'y'.repeat(100)}${bel}tail`
    const result = truncateTerminalOutput(input, maxChars)

    assert.ok(result.output.length <= maxChars)
    assert.match(result.output, /output truncated/)
    assert.ok(result.output.endsWith('tail'))
    assert.ok(!result.output.includes('y'))
  })

  test('updates the addon buffer to the capped output', async () => {
    const { default: AttachAddonCustom } = await loadModule()
    const addon = new AttachAddonCustom({}, {})
    addon._maxBufferChars = 96
    addon._writeBuffer = [`old line\n${'z'.repeat(300)}`]
    addon._bufferChars = addon._writeBuffer[0].length

    addon._dropOldestUntil()

    assert.equal(addon._writeBuffer.length, 1)
    assert.equal(addon._bufferChars, addon._writeBuffer[0].length)
    assert.ok(addon._bufferChars <= addon._maxBufferChars)
    assert.match(addon._writeBuffer[0], /output truncated/)
  })
})

const makeAddon = async () => {
  const { default: AttachAddonCustom } = await loadModule()
  const written = []
  const addon = new AttachAddonCustom({ write: (s) => written.push(s) }, {})
  addon._sendData = () => {}
  return { addon, written }
}

describe('output suppression', () => {
  test('a second suppression replaces the first instead of overlapping', async () => {
    const { addon } = await makeAddon()
    const ended = []
    // keepalive-style short window, then the long shell-integration one
    addon.startOutputSuppression(200, () => ended.push('first'), true)
    addon.startOutputSuppression(1000, () => ended.push('second'), true)

    // the replaced window is released right away, the new one is still armed
    assert.deepEqual(ended, ['first'])

    await new Promise(resolve => setTimeout(resolve, 400))

    // the stale 200ms timer must NOT have ended the new window early
    assert.deepEqual(ended, ['first'])
    assert.equal(addon.outputSuppressed, true)

    addon.stopOutputSuppression(true)
    assert.deepEqual(ended, ['first', 'second'])
  })

  test('dispose releases a pending suppression callback', async () => {
    const { addon } = await makeAddon()
    let released = false
    addon.startOutputSuppression(10000, () => {
      released = true
    }, true)

    addon.dispose()

    assert.equal(released, true)
    assert.equal(addon.suppressTimeout, null)
    assert.equal(addon.outputSuppressed, false)
  })

  test('onInitialData does not wait on a disposed addon', async () => {
    const { addon } = await makeAddon()
    let called = false
    addon.dispose()
    addon.onInitialData(() => {
      called = true
    })
    assert.equal(called, false)
  })
})

describe('waitForOutputIdle', () => {
  test('resolves once output stops', async () => {
    const { addon } = await makeAddon()
    addon._lastDataTime = Date.now()
    const quiet = addon.waitForOutputIdle({ idleMs: 100, timeoutMs: 2000 })
    const result = await quiet
    assert.equal(result, true)
  })

  test('times out instead of hanging while output keeps flowing', async () => {
    const { addon } = await makeAddon()
    const pusher = setInterval(() => {
      addon._lastDataTime = Date.now()
    }, 20)
    const result = await addon.waitForOutputIdle({ idleMs: 400, timeoutMs: 300 })
    clearInterval(pusher)
    assert.equal(result, false)
  })

  test('resolves immediately once disposed', async () => {
    const { addon } = await makeAddon()
    const pending = addon.waitForOutputIdle({ idleMs: 500, timeoutMs: 5000 })
    addon.dispose()
    assert.equal(await pending, false)
  })
})
