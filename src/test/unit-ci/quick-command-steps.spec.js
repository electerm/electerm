const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadRunner = () => import('../../client/components/terminal/automation/step-runner.js')
const loadKeys = () => import('../../client/components/terminal/automation/key-sequences.js')
const loadSteps = () => import('../../client/common/quick-command-steps.js')

const esc = '\x1b'

function recorder () {
  const sent = []
  return { sent, send: data => sent.push(data) }
}

describe('key sequences', () => {
  test('maps named keys case-insensitively', async () => {
    const { keySequence } = await loadKeys()
    assert.equal(keySequence('Enter'), '\r')
    assert.equal(keySequence('tab'), '\t')
    assert.equal(keySequence('ESC'), esc)
    assert.equal(keySequence('Backspace'), '\x7f')
    assert.equal(keySequence('Delete'), esc + '[3~')
    assert.equal(keySequence('Page Up'), esc + '[5~')
    assert.equal(keySequence('F1'), esc + 'OP')
    assert.equal(keySequence('f12'), esc + '[24~')
  })

  test('maps Ctrl combinations to control characters', async () => {
    const { keySequence } = await loadKeys()
    assert.equal(keySequence('Ctrl+C'), '\x03')
    assert.equal(keySequence('ctrl+z'), '\x1a')
    assert.equal(keySequence('Ctrl+['), esc)
    assert.equal(keySequence('Ctrl+1'), '')
  })

  test('cursor keys follow application cursor mode', async () => {
    const { keySequence } = await loadKeys()
    assert.equal(keySequence('Up'), esc + '[A')
    assert.equal(keySequence('Home'), esc + '[H')
    assert.equal(keySequence('Up', { applicationCursor: true }), esc + 'OA')
    assert.equal(keySequence('End', { applicationCursor: true }), esc + 'OF')
  })

  test('returns empty for unknown names', async () => {
    const { keySequence } = await loadKeys()
    assert.equal(keySequence('NotAKey'), '')
    assert.equal(keySequence(''), '')
    assert.equal(keySequence(undefined), '')
    assert.equal(keySequence('toString'), '')
  })

  test('every offered key resolves', async () => {
    const { keySequence, keyOptions } = await loadKeys()
    for (const name of keyOptions) {
      assert.ok(keySequence(name), name)
    }
  })
})

describe('step runner', () => {
  test('sends text and key steps in order', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    const result = await runSteps([
      { type: 'key', value: 'Backspace', repeat: 6 },
      { type: 'text', value: 'admin', enter: true },
      { type: 'text', value: 'en' },
      { type: 'key', value: 'Enter' }
    ], { send }).done
    assert.deepEqual(sent, ['\x7f'.repeat(6), 'admin\r', 'en', '\r'])
    assert.deepEqual(result, { status: 'done', index: 4 })
  })

  test('sends text without expanding escapes', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    await runSteps([
      { type: 'text', value: 'dir C:\\temp\\new ^C', enter: true }
    ], { send }).done
    assert.deepEqual(sent, ['dir C:\\temp\\new ^C\r'])
  })

  test('resolves templates in text steps', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    await runSteps([
      { type: 'text', value: 'echo {{clipboard}}', enter: true }
    ], {
      send,
      resolveText: async text => text.replace('{{clipboard}}', 'pasted')
    }).done
    assert.deepEqual(sent, ['echo pasted\r'])
  })

  test('uses application cursor mode from the terminal', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    await runSteps([{ type: 'key', value: 'Up' }], {
      send,
      getKeyOptions: () => ({ applicationCursor: true })
    }).done
    assert.deepEqual(sent, [esc + 'OA'])
  })

  test('skips unknown step types and key names', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    const result = await runSteps([
      { type: 'future', value: 'x' },
      { type: 'key', value: 'NotAKey' },
      null,
      { type: 'text', value: 'ok' }
    ], { send }).done
    assert.deepEqual(sent, ['ok'])
    assert.equal(result.status, 'done')
  })

  test('waits the delay before a step, including the first', async () => {
    const { runSteps } = await loadRunner()
    const times = []
    const start = Date.now()
    await runSteps([
      { type: 'text', value: 'a', delay: 60 },
      { type: 'text', value: 'b', delay: 0 },
      { type: 'text', value: 'c', delay: 60 }
    ], { send: () => times.push(Date.now() - start) }).done
    assert.ok(times[0] >= 50, `first step at ${times[0]}ms`)
    assert.ok(times[1] - times[0] < 40, `no wait for delay 0, gap ${times[1] - times[0]}ms`)
    assert.ok(times[2] - times[1] >= 50, `gap was ${times[2] - times[1]}ms`)
  })

  test('stop() ends a run in the middle of a delay', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    const run = runSteps([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b', delay: 60000 }
    ], { send })
    setTimeout(() => run.stop(), 20)
    const start = Date.now()
    const result = await run.done
    assert.ok(Date.now() - start < 1000)
    assert.deepEqual(sent, ['a'])
    assert.deepEqual(result, { status: 'stopped', index: 1 })
  })

  test('stop() right after starting sends nothing', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    const run = runSteps([{ type: 'key', value: 'Enter' }], { send })
    run.stop()
    const result = await run.done
    assert.deepEqual(sent, [])
    assert.deepEqual(result, { status: 'stopped', index: 0 })
  })

  test('ends when the tab closes during a delay', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    let alive = true
    const result = await runSteps([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b', delay: 30 }
    ], {
      send: data => {
        send(data)
        alive = false
      },
      isAlive: () => alive
    }).done
    assert.deepEqual(sent, ['a'])
    assert.deepEqual(result, { status: 'closed', index: 1 })
  })

  test('does not send text if the tab closes while templates resolve', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    let alive = true
    const result = await runSteps([{ type: 'text', value: 'x' }], {
      send,
      isAlive: () => alive,
      resolveText: async text => {
        alive = false
        return text
      }
    }).done
    assert.deepEqual(sent, [])
    assert.deepEqual(result, { status: 'closed', index: 0 })
  })

  test('reports an error from a step and stops', async () => {
    const { runSteps } = await loadRunner()
    const { sent, send } = recorder()
    const result = await runSteps([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' }
    ], {
      send,
      resolveText: async () => { throw new Error('boom') }
    }).done
    assert.deepEqual(sent, [])
    assert.equal(result.status, 'error')
    assert.equal(result.error.message, 'boom')
  })
})

describe('quick command steps', () => {
  test('old quick commands run as before', async () => {
    const { quickCommandSteps } = await loadSteps()
    const steps = quickCommandSteps({
      commands: [
        { id: '1', command: 'ls', delay: 300 },
        { id: '2', command: 'pwd' }
      ]
    })
    assert.deepEqual(steps, [
      { type: 'text', value: 'ls', enter: true, delay: 300 },
      { type: 'text', value: 'pwd', enter: true, delay: 100 }
    ])
  })

  test('old inputOnly applies to steps without their own Enter', async () => {
    const { quickCommandSteps } = await loadSteps()
    const steps = quickCommandSteps({
      inputOnly: true,
      commands: [
        { command: 'a' },
        { command: 'b', enter: true }
      ]
    })
    assert.deepEqual(steps.map(s => s.enter), [false, true])
  })

  test('the single command field of very old quick commands still works', async () => {
    const { quickCommandSteps } = await loadSteps()
    assert.deepEqual(quickCommandSteps({ command: 'uptime' }), [
      { type: 'text', value: 'uptime', enter: true, delay: 100 }
    ])
    assert.deepEqual(quickCommandSteps(null), [])
  })

  test('key steps, per-step Enter, and 0 ms delays', async () => {
    const { quickCommandSteps } = await loadSteps()
    const steps = quickCommandSteps({
      commands: [
        { type: 'key', key: 'Backspace', repeat: 6, delay: 0 },
        { command: 'admin', enter: true, delay: 0 },
        { command: 'en', enter: false, delay: 1200 }
      ]
    })
    assert.deepEqual(steps, [
      { type: 'key', value: 'Backspace', repeat: 6, delay: 0 },
      { type: 'text', value: 'admin', enter: true, delay: 0 },
      { type: 'text', value: 'en', enter: false, delay: 1200 }
    ])
  })

  test('multi-line commands get \\n\\r on Windows, as before', async () => {
    const { quickCommandSteps } = await loadSteps()
    const qm = { commands: [{ command: 'a\nb' }] }
    assert.equal(quickCommandSteps(qm, { isWin: true })[0].value, 'a\n\rb')
    assert.equal(quickCommandSteps(qm)[0].value, 'a\nb')
  })

  test('bad or empty delays fall back to 100 ms', async () => {
    const { stepDelay } = await loadSteps()
    assert.equal(stepDelay({}), 100)
    assert.equal(stepDelay({ delay: '' }), 100)
    assert.equal(stepDelay({ delay: null }), 100)
    assert.equal(stepDelay({ delay: 'x' }), 100)
    assert.equal(stepDelay({ delay: 0 }), 0)
    assert.equal(stepDelay({ delay: -5 }), 0)
    assert.equal(stepDelay({ delay: 250.7 }), 250)
  })
})
