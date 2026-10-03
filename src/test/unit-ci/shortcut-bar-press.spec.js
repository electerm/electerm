/**
 * shortcut-bar-press: press-and-hold auto-repeat for the touch shortcut bar.
 *
 * The bar used to send a key from `click` alone, so holding a key sent it
 * once and stopped — the complaint that started this. These tests pin the
 * whole gesture contract with fake timers, since the behaviour is entirely
 * about timing:
 *   - a tap sends nothing until it is released (the click does the sending)
 *   - a hold repeats, and keeps repeating until the pointer lifts
 *   - a press that slides away first is a scroll, never a stray key
 *   - `up()` / `cancel()` report the same thing, because either the button's
 *     own handler or the window-level safety net may run first, and the
 *     caller uses that answer to swallow the trailing click exactly once
 */

const { describe, test, mock } = require('node:test')
const assert = require('node:assert/strict')

const load = async () => {
  const m = await import(
    '../../client/components/terminal/shortcut-bar-press.js'
  )
  return m
}

const DELAY = 400
const INTERVAL = 60

// a press at a fixed point; pointerId identifies the finger
const press = (x = 10, y = 10, pointerId = 1) => ({
  clientX: x,
  clientY: y,
  pointerId,
  button: 0
})

const move = (x, y, pointerId = 1) => ({ clientX: x, clientY: y, pointerId })

const BKSP = { id: 'backspace', label: 'Bksp', data: '\x7f' }
const DOWN = { id: 'arrow-down', label: '↓', data: '\x1b[B' }

// builds a repeat with short, fake-friendly timing plus a record of every send
function makeRepeat (over = {}) {
  return load().then(({ createKeyRepeat }) => {
    const sent = []
    const states = []
    const r = createKeyRepeat({
      delay: DELAY,
      interval: INTERVAL,
      send: b => sent.push(b.id),
      onRepeatChange: b => states.push(b ? b.id : null),
      ...over
    })
    return { r, sent, states }
  })
}

// every test drives fake timers, so nothing here can leak a real interval
function withClock (fn) {
  return async () => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
    try {
      await fn(mock.timers)
    } finally {
      mock.timers.reset()
    }
  }
}

// Cross the hold threshold, then let `n` intervals elapse.
//
// Two ticks, not one: node's mock timers do not run timers that were created
// *during* a tick, and the repeat interval is created inside the threshold
// timeout — so a single tick(DELAY + n * INTERVAL) would only ever observe
// the first send.
const hold = (clock, n = 0) => {
  clock.tick(DELAY)
  if (n > 0) {
    clock.tick(INTERVAL * n)
  }
}

describe('shortcut-bar-press: a tap is still one key', () => {
  test('holding under the delay sends nothing at all', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    mock.timers.tick(DELAY - 1)
    assert.deepEqual(sent, [])
    r.up()
  }))

  test('a released tap is not a long press, so the click is not swallowed', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    mock.timers.tick(DELAY - 1)
    // false => the click that follows fires and sends exactly one key
    assert.equal(r.up(), false)
    assert.deepEqual(sent, [])
  }))

  test('a move past the tolerance before the delay is a scroll, not a key', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press(10, 10))
    mock.timers.tick(100)
    r.move(move(60, 12))
    // well past the hold threshold now — a scroll must not fire
    mock.timers.tick(2000)
    assert.deepEqual(sent, [])
    assert.equal(r.repeating, false)
  }))

  test('a release after a scroll still sends nothing', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    mock.timers.tick(100)
    r.move(move(80, 80))
    assert.equal(r.up(), false)
    assert.deepEqual(sent, [])
  }))
})

describe('shortcut-bar-press: holding repeats the key', () => {
  test('sends once when the hold threshold is reached', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    mock.timers.tick(DELAY)
    assert.deepEqual(sent, ['backspace'])
    r.up()
  }))

  test('keeps sending at the interval while held', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    hold(clock, 4)
    // the threshold send plus four ticks
    assert.deepEqual(sent, ['backspace', 'backspace', 'backspace', 'backspace', 'backspace'])
    r.up()
  }))

  test('stops the moment the pointer lifts', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(DOWN, press())
    hold(clock, 2)
    const atRelease = sent.length
    assert.equal(r.up(), true)
    mock.timers.tick(5000)
    assert.equal(sent.length, atRelease)
  }))

  test('reports the repeating button so only it looks pressed', withClock(async clock => {
    const { r, states } = await makeRepeat()
    r.down(DOWN, press())
    assert.deepEqual(states, [])
    hold(clock)
    assert.deepEqual(states, ['arrow-down'])
    r.up()
    assert.deepEqual(states, ['arrow-down', null])
  }))

  test('a long press is reported on release so the click is swallowed', withClock(async clock => {
    const { r } = await makeRepeat()
    r.down(DOWN, press())
    hold(clock, 1)
    // true => the browser's trailing click must NOT send one more key
    assert.equal(r.up(), true)
  }))

  test('a held finger may drift without stopping the repeat', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press(100, 100))
    hold(clock)
    // 20px of drift: past the pre-repeat tolerance, inside the repeat one
    r.move(move(120, 108))
    mock.timers.tick(INTERVAL * 2)
    assert.equal(r.repeating, true)
    assert.equal(sent.length, 3)
    r.up()
  }))

  test('drifting far while repeating is a scroll, and stops cleanly', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press(100, 100))
    hold(clock, 1)
    const before = sent.length
    r.move(move(300, 100))
    assert.equal(r.repeating, false)
    mock.timers.tick(5000)
    assert.equal(sent.length, before)
  }))
})

describe('shortcut-bar-press: cancellation never leaks a key', () => {
  test('pointercancel stops the repeat dead', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    hold(clock)
    r.cancel()
    mock.timers.tick(5000)
    // whatever was sent before the cancel stands; nothing more follows
    assert.equal(sent.length, 1)
    assert.equal(r.repeating, false)
  }))

  test('a cancel before the threshold sends nothing and swallows no click', withClock(async () => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    mock.timers.tick(100)
    r.cancel()
    // false => the click is NOT swallowed; the tap still delivers its one key
    assert.equal(r.cancel(), false)
    mock.timers.tick(5000)
    assert.deepEqual(sent, [])
  }))

  test('dispose (bar hidden / unmount) kills the timer', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press())
    hold(clock)
    r.dispose()
    mock.timers.tick(5000)
    assert.equal(sent.length, 1)
  }))
})

describe('shortcut-bar-press: one press at a time', () => {
  test('a second press takes over from the first', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press(10, 10, 1))
    hold(clock)
    assert.deepEqual(sent, ['backspace'])
    // second finger on another key
    r.down(DOWN, press(80, 10, 2))
    hold(clock, 2)
    assert.deepEqual(sent, ['backspace', 'arrow-down', 'arrow-down', 'arrow-down'])
    r.up()
  }))

  test('events from a finger that no longer owns the press are ignored', withClock(async clock => {
    const { r, sent } = await makeRepeat()
    r.down(BKSP, press(10, 10, 1))
    hold(clock)
    // a second finger takes the bar over
    r.down(DOWN, press(80, 10, 2))
    hold(clock)
    const afterTakeover = sent.length
    // the first finger now drifts / lifts; it must not disturb finger 2's
    // repeat — this is the "flick the bar while pressing" case
    r.move(move(400, 400, 1))
    r.up(press(10, 10, 1))
    r.cancel(press(10, 10, 1))
    mock.timers.tick(INTERVAL * 3)
    assert.equal(r.repeating, true)
    assert.equal(sent.length, afterTakeover + 3)
    assert.equal(sent[sent.length - 1], 'arrow-down')
    r.up(press(80, 10, 2))
  }))

  test('the repeat state follows the button that owns the live press', withClock(async clock => {
    const { r, states } = await makeRepeat()
    r.down(BKSP, press(10, 10, 1))
    hold(clock)
    r.down(DOWN, press(80, 10, 2))
    // Bksp stops lighting up before ↓ starts
    assert.deepEqual(states, ['backspace', null])
    hold(clock)
    assert.deepEqual(states, ['backspace', null, 'arrow-down'])
    r.up()
  }))
})
