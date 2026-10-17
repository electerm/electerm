const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadRunner = () => import('../../client/components/terminal/automation/step-runner.js')
const loadWatch = () => import('../../client/components/terminal/automation/output-watch.js')
const loadSteps = () => import('../../client/common/quick-command-steps.js')

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

// a fake terminal: sending marks the output, like runInTab does
async function fakeTerm () {
  const { createOutputWatch } = await loadWatch()
  const watch = createOutputWatch()
  const sent = []
  return {
    sent,
    watch,
    send: data => {
      watch.mark()
      sent.push(data)
    },
    output: str => watch.push(str)
  }
}

const wait = (value, timeout = 1000) => ({ type: 'wait', value, timeout })

describe('output watch', () => {
  test('finds text split across chunks, without colors or case', async () => {
    const { createOutputWatch } = await loadWatch()
    const watch = createOutputWatch()
    let found = false
    watch.watch('password:').found.then(() => { found = true })
    watch.push('Pass')
    await tick()
    assert.equal(found, false)
    watch.push('\x1b[1mWORD\x1b[0m: ')
    await tick()
    assert.equal(found, true)
  })

  test('mark() drops output that came before it', async () => {
    const { createOutputWatch } = await loadWatch()
    const watch = createOutputWatch()
    watch.push('switch# ')
    watch.mark()
    let found = false
    watch.watch('#').found.then(() => { found = true })
    await tick()
    assert.equal(found, false)
    watch.push('show run\r\nswitch# ')
    await tick()
    assert.equal(found, true)
  })

  test('a match uses up the output, so the next watch needs new output', async () => {
    const { createOutputWatch } = await loadWatch()
    const watch = createOutputWatch()
    watch.push('a> ')
    await watch.watch('>').found
    let found = false
    watch.watch('>').found.then(() => { found = true })
    await tick()
    assert.equal(found, false)
    watch.push('b> ')
    await tick()
    assert.equal(found, true)
  })

  test('cancel() drops the watch', async () => {
    const { createOutputWatch } = await loadWatch()
    const watch = createOutputWatch()
    let found = false
    const w = watch.watch('x')
    w.found.then(() => { found = true })
    w.cancel()
    watch.push('x')
    await tick()
    assert.equal(found, false)
  })
})

describe('wait steps', () => {
  test('the next step waits until the text shows up', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    const run = runSteps([
      { type: 'text', value: 'enable', enter: true },
      wait('Password:'),
      { type: 'text', value: 'secret', enter: true }
    ], { send: t.send, watchText: t.watch.watch })
    await tick(20)
    assert.deepEqual(t.sent, ['enable\r'])
    t.output('enable\r\nPassword: ')
    const result = await run.done
    assert.deepEqual(t.sent, ['enable\r', 'secret\r'])
    assert.equal(result.status, 'done')
  })

  test('output that arrives before the wait step starts still counts', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    const run = runSteps([
      { type: 'text', value: 'enable', enter: true },
      { ...wait('Password:'), delay: 50 },
      { type: 'text', value: 'secret', enter: true }
    ], { send: t.send, watchText: t.watch.watch })
    await tick(10)
    t.output('Password: ')
    const result = await run.done
    assert.equal(result.status, 'done')
    assert.deepEqual(t.sent, ['enable\r', 'secret\r'])
  })

  test('the prompt already on screen does not count', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    t.output('switch# ')
    const run = runSteps([
      { type: 'text', value: 'show run', enter: true },
      wait('#', 100),
      { type: 'text', value: 'exit', enter: true }
    ], { send: t.send, watchText: t.watch.watch })
    const result = await run.done
    assert.deepEqual(result, { status: 'timeout', index: 1 })
    assert.deepEqual(t.sent, ['show run\r'])
  })

  test('times out and stops the run', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    const start = Date.now()
    const result = await runSteps([
      wait('never', 80),
      { type: 'text', value: 'next', enter: true }
    ], { send: t.send, watchText: t.watch.watch }).done
    assert.deepEqual(result, { status: 'timeout', index: 0 })
    assert.ok(Date.now() - start >= 70)
    assert.deepEqual(t.sent, [])
  })

  test('stop() ends a wait at once', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    const run = runSteps([wait('never', 0), { type: 'text', value: 'x' }], {
      send: t.send,
      watchText: t.watch.watch
    })
    await tick(20)
    run.stop()
    assert.deepEqual(await run.done, { status: 'stopped', index: 0 })
    assert.deepEqual(t.sent, [])
  })

  test('a wait with no timeout ends when the tab closes', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    let alive = true
    const run = runSteps([wait('never', 0)], {
      send: t.send,
      watchText: t.watch.watch,
      isAlive: () => alive
    })
    await tick(20)
    alive = false
    assert.deepEqual(await run.done, { status: 'closed', index: 0 })
  })

  test('two waits in a row need two matches', async () => {
    const { runSteps } = await loadRunner()
    const t = await fakeTerm()
    const run = runSteps([wait('>'), wait('>'), { type: 'text', value: 'done' }], {
      send: t.send,
      watchText: t.watch.watch
    })
    t.output('a> ')
    await tick(20)
    assert.deepEqual(t.sent, [])
    t.output('b> ')
    await run.done
    assert.deepEqual(t.sent, ['done'])
  })
})

describe('saved wait steps', () => {
  test('convert with the timeout in ms, 10 s when missing', async () => {
    const { quickCommandSteps } = await loadSteps()
    const steps = quickCommandSteps({
      commands: [
        { type: 'wait', text: 'Password:', timeout: 5, delay: 0 },
        { type: 'wait', text: '#' },
        { type: 'wait', text: '#', timeout: 0, delay: 200 },
        { type: 'wait', text: '#', timeout: 'x' }
      ]
    })
    assert.deepEqual(steps, [
      { type: 'wait', value: 'Password:', timeout: 5000, delay: 0 },
      { type: 'wait', value: '#', timeout: 10000, delay: 100 },
      { type: 'wait', value: '#', timeout: 0, delay: 200 },
      { type: 'wait', value: '#', timeout: 10000, delay: 100 }
    ])
  })
})
