const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadRunner = () => import('../../client/components/terminal/automation/step-runner.js')
const loadGroup = () => import('../../client/components/terminal/automation/ask-group.js')
const loadSteps = () => import('../../client/common/quick-command-steps.js')

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

// a fake dialog: questions wait until answer() or cancel
function fakeAsk () {
  const open = []
  const ask = step => {
    let resolve
    const answer = new Promise(_resolve => { resolve = _resolve })
    const q = { step, resolve, cancelled: false }
    open.push(q)
    return {
      answer,
      cancel () {
        q.cancelled = true
        resolve(null)
      }
    }
  }
  return { open, ask }
}

// fake dialogs for an ask group: open() records each dialog until it is
// answered or closed
function fakeDialogs () {
  const all = []
  const open = ({ step, tabId, shared }) => {
    let resolve
    const answer = new Promise(_resolve => { resolve = _resolve })
    const d = { step, tabId, shared, closed: false, resolve }
    all.push(d)
    return {
      answer,
      close () {
        d.closed = true
      }
    }
  }
  // dialogs on screen: not closed and not answered
  const showing = () => all.filter(d => !d.closed && !d.answered)
  const answer = (d, value) => {
    d.answered = true
    d.resolve(value)
  }
  return { open, showing, answer }
}

// runs the steps in each tab with one ask group, like runQuickCommandItem
async function runInTabs (tabIds, steps) {
  const { runSteps } = await loadRunner()
  const { createAskGroup } = await loadGroup()
  const d = fakeDialogs()
  const group = createAskGroup(d.open)
  const sent = {}
  const runs = {}
  for (const tabId of tabIds) {
    sent[tabId] = []
    runs[tabId] = runSteps(steps, {
      send: s => sent[tabId].push(s),
      askInput: (step, index) => group.ask(step, index, tabId)
    })
  }
  return { d, group, sent, runs }
}

const prompt = (value, more) => ({ type: 'prompt', value, hidden: true, enter: true, ...more })

describe('prompt steps', () => {
  test('ask, then send the answer with Enter', async () => {
    const { runSteps } = await loadRunner()
    const sent = []
    const d = fakeAsk()
    const run = runSteps([
      { type: 'text', value: 'enable', enter: true },
      prompt('Password'),
      { type: 'text', value: 'show run', enter: true }
    ], { send: s => sent.push(s), askInput: d.ask })
    await tick(10)
    assert.deepEqual(sent, ['enable\r'])
    assert.equal(d.open.length, 1)
    assert.equal(d.open[0].step.value, 'Password')
    d.open[0].resolve('s3cret')
    const result = await run.done
    assert.equal(result.status, 'done')
    assert.deepEqual(sent, ['enable\r', 's3cret\r', 'show run\r'])
  })

  test('no Enter when the step turns it off', async () => {
    const { runSteps } = await loadRunner()
    const sent = []
    const d = fakeAsk()
    const run = runSteps([prompt('VLAN', { enter: false })], {
      send: s => sent.push(s),
      askInput: d.ask
    })
    await tick(10)
    d.open[0].resolve('20')
    await run.done
    assert.deepEqual(sent, ['20'])
  })

  test('cancelling the question ends the run', async () => {
    const { runSteps } = await loadRunner()
    const sent = []
    const d = fakeAsk()
    const run = runSteps([prompt('Password'), { type: 'text', value: 'next' }], {
      send: s => sent.push(s),
      askInput: d.ask
    })
    await tick(10)
    d.open[0].resolve(null)
    assert.deepEqual(await run.done, { status: 'cancelled', index: 0 })
    assert.deepEqual(sent, [])
  })

  test('stop() closes the question', async () => {
    const { runSteps } = await loadRunner()
    const d = fakeAsk()
    const run = runSteps([prompt('Password')], { send: () => {}, askInput: d.ask })
    await tick(10)
    run.stop()
    assert.deepEqual(await run.done, { status: 'stopped', index: 0 })
    assert.equal(d.open[0].cancelled, true)
  })

  test('closing the tab closes the question', async () => {
    const { runSteps } = await loadRunner()
    const d = fakeAsk()
    let alive = true
    const run = runSteps([prompt('Password')], {
      send: () => {},
      askInput: d.ask,
      isAlive: () => alive
    })
    await tick(10)
    alive = false
    assert.deepEqual(await run.done, { status: 'closed', index: 0 })
    assert.equal(d.open[0].cancelled, true)
  })

  test('an empty answer still sends Enter', async () => {
    const { runSteps } = await loadRunner()
    const sent = []
    const d = fakeAsk()
    const run = runSteps([prompt('Press Enter')], { send: s => sent.push(s), askInput: d.ask })
    await tick(10)
    d.open[0].resolve('')
    await run.done
    assert.deepEqual(sent, ['\r'])
  })
})

describe('prompts in several tabs', () => {
  test('asks once and sends the answer to every tab', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Password'), prompt('VLAN', { hidden: false })])
    await tick(10)
    assert.equal(t.d.showing().length, 1)
    assert.equal(t.d.showing()[0].shared, true)
    t.d.answer(t.d.showing()[0], 'pw')
    await tick(10)
    assert.equal(t.d.showing().length, 1)
    t.d.answer(t.d.showing()[0], '20')
    await Promise.all([t.runs.a.done, t.runs.b.done])
    assert.deepEqual(t.sent.a, ['pw\r', '20\r'])
    assert.deepEqual(t.sent.b, ['pw\r', '20\r'])
  })

  test('stopping one tab keeps the question open for the others', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Password')])
    await tick(10)
    t.runs.a.stop()
    assert.equal((await t.runs.a.done).status, 'stopped')
    assert.equal(t.d.showing().length, 1)
    t.d.answer(t.d.showing()[0], 'pw')
    assert.equal((await t.runs.b.done).status, 'done')
    assert.deepEqual(t.sent.b, ['pw\r'])
  })

  test('the question closes when every tab stops', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Password')])
    await tick(10)
    t.runs.a.stop()
    t.runs.b.stop()
    await Promise.all([t.runs.a.done, t.runs.b.done])
    assert.equal(t.d.showing().length, 0)
  })

  test('cancelling a shared question ends the run in every tab', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Password'), { type: 'text', value: 'x' }])
    await tick(10)
    t.d.answer(t.d.showing()[0], null)
    assert.equal((await t.runs.a.done).status, 'cancelled')
    assert.equal((await t.runs.b.done).status, 'cancelled')
    assert.deepEqual([t.sent.a, t.sent.b], [[], []])
  })

  test('turned off, each tab gets its own dialog and answer', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Hostname'), prompt('VLAN')])
    await tick(10)
    t.group.setShared(false)
    const each = t.d.showing()
    assert.deepEqual(each.map(x => [x.tabId, x.shared]), [['a', false], ['b', false]])
    t.d.answer(each[0], 'sw-a')
    t.d.answer(each[1], 'sw-b')
    await tick(10)
    // the setting holds for the next question
    const next = t.d.showing()
    assert.deepEqual(next.map(x => [x.step.value, x.tabId]), [['VLAN', 'a'], ['VLAN', 'b']])
    t.d.answer(next[0], '10')
    t.d.answer(next[1], '20')
    await Promise.all([t.runs.a.done, t.runs.b.done])
    assert.deepEqual(t.sent.a, ['sw-a\r', '10\r'])
    assert.deepEqual(t.sent.b, ['sw-b\r', '20\r'])
  })

  test('cancelling one tab dialog ends only that tab', async () => {
    const t = await runInTabs(['a', 'b'], [prompt('Password')])
    await tick(10)
    t.group.setShared(false)
    const [da, db] = t.d.showing()
    t.d.answer(da, null)
    assert.equal((await t.runs.a.done).status, 'cancelled')
    t.d.answer(db, 'pw')
    assert.equal((await t.runs.b.done).status, 'done')
    assert.deepEqual(t.sent.b, ['pw\r'])
  })

  test('turned back on, the tab dialogs fold into one', async () => {
    const t = await runInTabs(['a', 'b', 'c'], [prompt('Password')])
    await tick(10)
    t.group.setShared(false)
    const each = t.d.showing()
    assert.equal(each.length, 3)
    t.d.answer(each[0], 'pw-a')
    await tick(10)
    t.group.setShared(true)
    const one = t.d.showing()
    assert.deepEqual(one.map(x => [x.tabId, x.shared]), [[null, true]])
    t.d.answer(one[0], 'pw')
    await Promise.all(Object.values(t.runs).map(r => r.done))
    assert.deepEqual([t.sent.a, t.sent.b, t.sent.c], [['pw-a\r'], ['pw\r'], ['pw\r']])
  })

  test('a tab that gets to an answered question uses the answer', async () => {
    const { runSteps } = await loadRunner()
    const { createAskGroup } = await loadGroup()
    const d = fakeDialogs()
    const group = createAskGroup(d.open)
    const sent = []
    const fast = runSteps([prompt('Password')], { send: () => {}, askInput: (s, i) => group.ask(s, i, 'a') })
    await tick(10)
    d.answer(d.showing()[0], 'pw')
    await fast.done
    const slow = runSteps([prompt('Password')], { send: s => sent.push(s), askInput: (s, i) => group.ask(s, i, 'b') })
    await slow.done
    assert.deepEqual(sent, ['pw\r'])
    assert.equal(d.showing().length, 0)
  })
})

describe('saved prompt steps', () => {
  test('hide the answer and send Enter unless turned off', async () => {
    const { quickCommandSteps } = await loadSteps()
    const steps = quickCommandSteps({
      commands: [
        { type: 'prompt', text: 'Password', delay: 0 },
        { type: 'prompt', text: 'VLAN', hidden: false, enter: false, delay: 0 }
      ]
    })
    assert.deepEqual(steps, [
      { type: 'prompt', value: 'Password', hidden: true, enter: true, delay: 0 },
      { type: 'prompt', value: 'VLAN', hidden: false, enter: false, delay: 0 }
    ])
  })
})
