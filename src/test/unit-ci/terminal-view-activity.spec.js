const { before, test } = require('node:test')
const assert = require('node:assert/strict')

let idleActivity, recordOutput, remainingIdleMs, observeOutputActivity
before(async () => {
  ;({ idleActivity, recordOutput, remainingIdleMs, observeOutputActivity } = await import('../../client/components/footer/terminal-view-activity.mjs'))
})

function activityAt (...times) {
  return times.reduce((state, now) => recordOutput(state, now, -1000, 100), idleActivity)
}

test('busy requires three batches spanning at least 750 ms', () => {
  assert.equal(activityAt(0, 750).busy, false)
  assert.equal(activityAt(0, 100, 749).busy, false)
  assert.equal(activityAt(0, 100, 750).busy, true)
})

test('a gap of 1500 ms starts a fresh burst', () => {
  assert.equal(activityAt(0, 100, 1599).busy, true)
  assert.deepEqual(activityAt(0, 100, 1600), activityAt(1600))
  assert.equal(remainingIdleMs(100, 1599), 1)
  assert.equal(remainingIdleMs(100, 1600), 0)
})

test('ignore echoes shorter than 64 characters within 300 ms of input', () => {
  const state = activityAt(0, 100)
  assert.equal(recordOutput(state, 1000, 701, 63), state)
  assert.equal(recordOutput(state, 1000, 700, 63).busy, true)
  assert.equal(recordOutput(state, 1000, 701, 64).busy, true)
})

test('notify once per transition and cancel the idle timer on unsubscribe', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  const pane = {}
  const changes = []
  const unsubscribe = observeOutputActivity(pane, busy => changes.push(busy))
  function writeAfter (ms) {
    t.mock.timers.tick(ms)
    pane.onOutputActivity(Date.now(), 0, 200)
  }
  writeAfter(0)
  writeAfter(200)
  writeAfter(550)
  writeAfter(1000)
  t.mock.timers.tick(1499)
  assert.deepEqual(changes, [true])
  t.mock.timers.tick(1)
  assert.deepEqual(changes, [true, false])
  writeAfter(0)
  writeAfter(100)
  writeAfter(650)
  unsubscribe()
  t.mock.timers.tick(2000)
  assert.equal(pane.onOutputActivity, undefined)
  assert.deepEqual(changes, [true, false, true])
})
