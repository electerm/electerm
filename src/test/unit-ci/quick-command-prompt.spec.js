const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadRunner = () => import('../../client/components/terminal/automation/step-runner.js')
const loadShared = () => import('../../client/components/terminal/automation/shared-ask.js')
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

describe('one question for several tabs', () => {
  test('asks once and sends the answer to every tab', async () => {
    const { runSteps } = await loadRunner()
    const { sharedAsk } = await loadShared()
    const d = fakeAsk()
    const askInput = sharedAsk(d.ask)
    const a = []
    const b = []
    const steps = [prompt('Password'), prompt('VLAN', { hidden: false })]
    const runA = runSteps(steps, { send: s => a.push(s), askInput })
    const runB = runSteps(steps, { send: s => b.push(s), askInput })
    await tick(10)
    assert.equal(d.open.length, 1)
    d.open[0].resolve('pw')
    await tick(10)
    assert.equal(d.open.length, 2)
    d.open[1].resolve('20')
    await Promise.all([runA.done, runB.done])
    assert.deepEqual(a, ['pw\r', '20\r'])
    assert.deepEqual(b, ['pw\r', '20\r'])
  })

  test('stopping one tab keeps the question open for the others', async () => {
    const { runSteps } = await loadRunner()
    const { sharedAsk } = await loadShared()
    const d = fakeAsk()
    const askInput = sharedAsk(d.ask)
    const b = []
    const runA = runSteps([prompt('Password')], { send: () => {}, askInput })
    const runB = runSteps([prompt('Password')], { send: s => b.push(s), askInput })
    await tick(10)
    runA.stop()
    assert.equal((await runA.done).status, 'stopped')
    assert.equal(d.open[0].cancelled, false)
    d.open[0].resolve('pw')
    assert.equal((await runB.done).status, 'done')
    assert.deepEqual(b, ['pw\r'])
  })

  test('the question closes when every tab stops', async () => {
    const { runSteps } = await loadRunner()
    const { sharedAsk } = await loadShared()
    const d = fakeAsk()
    const askInput = sharedAsk(d.ask)
    const runA = runSteps([prompt('Password')], { send: () => {}, askInput })
    const runB = runSteps([prompt('Password')], { send: () => {}, askInput })
    await tick(10)
    runA.stop()
    runB.stop()
    await Promise.all([runA.done, runB.done])
    assert.equal(d.open[0].cancelled, true)
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
