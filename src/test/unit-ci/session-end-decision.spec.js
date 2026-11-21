const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

// The decision is pure; no window/xterm involved.
const loadDecide = () => import('../../client/components/terminal/session-end.js')

const exit = (code, signal = null) => ({ known: true, code, signal })

describe('session end decision', () => {
  test('a clean exit closes the tab, which is what `exit` did before', async () => {
    const { decideSessionEnd } = await loadDecide()
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(0) }),
      { close: true, reason: 'clean-exit' }
    )
  })

  test('a non-zero exit keeps the tab so the output stays readable', async () => {
    const { decideSessionEnd } = await loadDecide()
    // `false; exit` in a unix shell, or cmd.exe reusing the last return code.
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(1) }),
      { close: false, reason: 'error-exit' }
    )
  })

  test('a signalled exit is not clean even with a status number', async () => {
    const { decideSessionEnd } = await loadDecide()
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(0, 'SIGHUP') }),
      { close: false, reason: 'signalled' }
    )
  })

  test('an unknown status never closes on its own', async () => {
    const { decideSessionEnd } = await loadDecide()
    // Network drop, server reboot, or a device that omits SSH exit-status.
    assert.deepEqual(
      decideSessionEnd({ exitStatus: null }),
      { close: false, reason: 'unknown' }
    )
    assert.deepEqual(
      decideSessionEnd({ exitStatus: { known: false, code: null, signal: null } }),
      { close: false, reason: 'unknown' }
    )
  })

  test('the typed line only decides when the backend reported nothing', async () => {
    const { decideSessionEnd } = await loadDecide()
    // telnet / serial / exit-status-less device: old rule, still time-boxed by
    // the caller.
    assert.deepEqual(
      decideSessionEnd({ exitStatus: null, userTypeExit: true }),
      { close: true, reason: 'typed-exit' }
    )
    assert.deepEqual(
      decideSessionEnd({
        exitStatus: { known: false, code: null, signal: null },
        userTypeExit: true
      }),
      { close: true, reason: 'typed-exit' }
    )
    // A known status always wins over the typed line: `exit` inside a nested
    // shell followed by a failed session must not close the tab (#4629).
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(1), userTypeExit: true }),
      { close: false, reason: 'error-exit' }
    )
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(0), userTypeExit: false }),
      { close: true, reason: 'clean-exit' }
    )
  })

  test('closeOnCleanExit is where the keep-the-tab decision lands', async () => {
    const { decideSessionEnd } = await loadDecide()
    assert.deepEqual(
      decideSessionEnd({ exitStatus: exit(0), closeOnCleanExit: false }),
      { close: false, reason: 'clean-exit-hold' }
    )
  })
})

describe('Enter to reload a stopped terminal session', () => {
  const stopped = { sessionStopped: true, reconnectCountdown: null }

  async function press (state, overrides = {}) {
    const { canReloadWithEnter, handleStoppedSessionEnter } = await loadDecide()
    const calls = []
    const handled = canReloadWithEnter(state) && handleStoppedSessionEnter({
      type: 'keydown',
      key: 'Enter',
      preventDefault: () => calls.push('prevent'),
      stopPropagation: () => calls.push('stop'),
      ...overrides
    }, () => calls.push('reload'))
    return { handled, calls }
  }

  test('consumes Enter and reloads once, including during a retry countdown', async () => {
    const reloaded = { handled: true, calls: ['prevent', 'stop', 'reload'] }
    assert.deepEqual(await press(stopped), reloaded)
    assert.deepEqual(await press({ sessionStopped: false, reconnectCountdown: 2 }), reloaded)
    assert.deepEqual(await press(stopped, { repeat: true }), { handled: true, calls: ['prevent', 'stop'] })
  })

  test('leaves live sessions, IME and modified keys alone', async () => {
    const ignored = { handled: false, calls: [] }
    assert.deepEqual(await press({ sessionStopped: false, reconnectCountdown: null }), ignored)
    for (const overrides of [
      { isComposing: true }, { shiftKey: true }, { ctrlKey: true }, { altKey: true },
      { metaKey: true }, { type: 'keyup' }, { key: 'Escape' }
    ]) {
      assert.deepEqual(await press(stopped, overrides), ignored)
    }
  })
})
