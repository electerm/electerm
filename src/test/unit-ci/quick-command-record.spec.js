const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/automation/record-steps.js')

const esc = '\x1b'

// one chunk per character, the way xterm reports typing
const typed = s => s.split('')

// the parts of a step that matter here
const brief = steps => steps.map(s => s.type === 'key'
  ? ['key', s.key, s.repeat]
  : ['command', s.command, s.enter])

describe('recording quick commands', () => {
  test('typed lines become command steps that send Enter', async () => {
    const { recordedSteps } = await load()
    const steps = recordedSteps([...typed('show vlan'), '\r', ...typed('exit'), '\r'])
    assert.deepEqual(brief(steps), [
      ['command', 'show vlan', true],
      ['command', 'exit', true]
    ])
    assert.ok(steps.every(s => s.delay === 0))
  })

  test('Enter on an empty line is a key step', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(brief(recordedSteps(['\r', '\r', ...typed('en'), '\r'])), [
      ['key', 'Enter', 2],
      ['command', 'en', true]
    ])
  })

  test('backspace edits unsent text, and is a key step on an empty line', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(brief(recordedSteps([...typed('shx'), '\x7f', ...typed('ow'), '\r'])), [
      ['command', 'show', true]
    ])
    assert.deepEqual(brief(recordedSteps(['\x7f', '\b'])), [
      ['key', 'Backspace', 2]
    ])
  })

  test('keys split text into a command without Enter, then a key step', async () => {
    const { recordedSteps } = await load()
    const steps = recordedSteps([...typed('sh ru'), '\t', ...typed(' | i vlan'), '\r'])
    assert.deepEqual(brief(steps), [
      ['command', 'sh ru', false],
      ['key', 'Tab', 1],
      ['command', ' | i vlan', true]
    ])
  })

  test('arrows in both cursor modes, F-keys and Ctrl keys', async () => {
    const { recordedSteps } = await load()
    const steps = recordedSteps([
      esc + '[A', esc + 'OA', esc + '[B',
      esc + '[15~', esc + 'OP',
      '\x03', '\x1a', esc + '[3~'
    ])
    assert.deepEqual(brief(steps), [
      ['key', 'Up', 2],
      ['key', 'Down', 1],
      ['key', 'F5', 1],
      ['key', 'F1', 1],
      ['key', 'Ctrl+C', 1],
      ['key', 'Ctrl+Z', 1],
      ['key', 'Delete', 1]
    ])
  })

  test('a lone Esc is a key', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(brief(recordedSteps([esc, ...typed(':q'), '\r'])), [
      ['key', 'Esc', 1],
      ['command', ':q', true]
    ])
  })

  test('drops replies the terminal sends on its own', async () => {
    const { recordedSteps } = await load()
    // cursor position report, device attributes, focus in and out
    const steps = recordedSteps([esc + '[12;1R', esc + '[?1;2c', esc + '[I', ...typed('ls'), esc + '[O', '\r'])
    assert.deepEqual(brief(steps), [
      ['command', 'ls', true]
    ])
  })

  test('a paste keeps its lines, and bracketed paste markers are dropped', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(brief(recordedSteps(['conf t\rvlan 10\rname users\r'])), [
      ['command', 'conf t', true],
      ['command', 'vlan 10', true],
      ['command', 'name users', true]
    ])
    assert.deepEqual(brief(recordedSteps([esc + '[200~echo hi' + esc + '[201~', '\r'])), [
      ['command', 'echo hi', true]
    ])
  })

  test('unfinished text at the end is kept without Enter', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(brief(recordedSteps(typed('copy run st'))), [
      ['command', 'copy run st', false]
    ])
  })

  test('nothing typed gives no steps, and ids come from makeId', async () => {
    const { recordedSteps } = await load()
    assert.deepEqual(recordedSteps([]), [])
    let n = 0
    const steps = recordedSteps(['a', '\r', '\t'], () => 'id' + (++n))
    assert.deepEqual(steps.map(s => s.id), ['id1', 'id2'])
  })

  test('recorded steps play back as the same bytes', async () => {
    const { recordedSteps } = await load()
    const { quickCommandSteps } = await import('../../client/common/quick-command-steps.js')
    const { runSteps } = await import('../../client/components/terminal/automation/step-runner.js')
    const input = [...typed('sh ru'), '\t', esc + '[A', esc + '[A', '\x03', ...typed('end'), '\r']
    const sent = []
    const qm = { commands: recordedSteps(input) }
    await runSteps(quickCommandSteps(qm, { isWin: false }), {
      send: d => sent.push(d),
      isAlive: () => true
    }).done
    assert.equal(sent.join(''), input.join(''))
  })
})
