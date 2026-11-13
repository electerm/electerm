const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadModule = () => import('../../client/common/custom-watcher.js')

describe('custom watcher command parsing', () => {
  test('keeps a plain command as typed', async () => {
    const { parseWatcherCommand } = await loadModule()
    assert.deepStrictEqual(parseWatcherCommand('nvidia-smi -i 0'), {
      command: 'nvidia-smi -i 0',
      interval: null
    })
    assert.deepStrictEqual(parseWatcherCommand('  df -h  '), {
      command: 'df -h',
      interval: null
    })
    assert.deepStrictEqual(parseWatcherCommand(''), { command: '', interval: null })
    assert.deepStrictEqual(parseWatcherCommand(undefined), { command: '', interval: null })
  })

  test('unwraps watch and takes its interval', async () => {
    const { parseWatcherCommand } = await loadModule()
    assert.deepStrictEqual(parseWatcherCommand("watch -n 1 'nvidia-smi -i 0'"), {
      command: 'nvidia-smi -i 0',
      interval: 1
    })
    assert.deepStrictEqual(parseWatcherCommand('watch -n1 nvidia-smi'), {
      command: 'nvidia-smi',
      interval: 1
    })
    assert.deepStrictEqual(parseWatcherCommand('watch --interval=2 "df -h"'), {
      command: 'df -h',
      interval: 2
    })
    // value-less flags are skipped, not mistaken for the command
    assert.deepStrictEqual(parseWatcherCommand("watch -d -t -n 3 'sensors'"), {
      command: 'sensors',
      interval: 3
    })
    assert.deepStrictEqual(parseWatcherCommand("watch 'sensors'"), {
      command: 'sensors',
      interval: null
    })
  })

  test('unwraps a hand written polling loop', async () => {
    const { parseWatcherCommand } = await loadModule()
    assert.deepStrictEqual(parseWatcherCommand('while true; do nvidia-smi -i 0; sleep 2; done'), {
      command: 'nvidia-smi -i 0',
      interval: 2
    })
    // not an exact wrapper: left alone
    const loopWithPipe = 'while true; do ps aux | head -3; sleep 1; done'
    assert.equal(parseWatcherCommand(loopWithPipe).command, 'ps aux | head -3')
    assert.equal(parseWatcherCommand('while read x; do echo $x; done').command, 'while read x; do echo $x; done')
  })

  test('is idempotent so a stored command is not unwrapped twice', async () => {
    const { parseWatcherCommand } = await loadModule()
    const once = parseWatcherCommand("watch -n 5 'uptime'")
    assert.deepStrictEqual(once, { command: 'uptime', interval: 5 })
    // the interval belongs to the watcher, the command itself stays as stored
    assert.deepStrictEqual(parseWatcherCommand(once.command), { command: 'uptime', interval: null })
  })
})

describe('custom watcher normalization', () => {
  test('clamps the interval and defaults it', async () => {
    const { normalizeWatcherInterval } = await loadModule()
    assert.equal(normalizeWatcherInterval(0), 5)
    assert.equal(normalizeWatcherInterval(-1), 5)
    assert.equal(normalizeWatcherInterval('nope'), 5)
    assert.equal(normalizeWatcherInterval(undefined, 7), 7)
    assert.equal(normalizeWatcherInterval(0.2), 1)
    assert.equal(normalizeWatcherInterval(1.26), 1.3)
    assert.equal(normalizeWatcherInterval(99999), 3600)
  })

  test('derives a name from the command when none is given', async () => {
    const { watcherName } = await loadModule()
    assert.equal(watcherName('GPU 0', 'nvidia-smi -i 0'), 'GPU 0')
    assert.equal(watcherName('   ', 'nvidia-smi -i 0'), 'nvidia-smi')
    assert.equal(watcherName('', '/usr/bin/df -h'), 'df')
    assert.equal(watcherName('', ''), 'custom')
  })

  test('drops entries without an id or command and de-duplicates ids', async () => {
    const { normalizeWatchers } = await loadModule()
    assert.deepStrictEqual(normalizeWatchers(null), [])
    assert.deepStrictEqual(normalizeWatchers([
      { id: 'a', name: 'GPU', command: "watch -n 1 'nvidia-smi'", interval: 1 },
      { id: 'a', name: 'dup', command: 'uptime' },
      { id: 'b', command: '' },
      { name: 'no id', command: 'uptime' },
      'nonsense'
    ]), [
      { id: 'a', name: 'GPU', command: 'nvidia-smi', interval: 1, enabled: true }
    ])
  })

  test('keeps switched-off watchers on the bookmark but out of the run list', async () => {
    const { activeWatchers } = await loadModule()
    const list = activeWatchers([
      { id: 'a', command: 'uptime', interval: 5 },
      { id: 'b', command: 'df -h', interval: 5, enabled: false }
    ])
    assert.deepStrictEqual(list.map(item => item.id), ['a'])
  })

  test('summarizes the first non-empty line', async () => {
    const { summarizeWatcherOutput, watcherBarSummary } = await loadModule()
    assert.equal(summarizeWatcherOutput('\n\n  GPU 0: 45C  \nmore'), 'GPU 0: 45C')
    assert.equal(summarizeWatcherOutput('   '), '')
    assert.equal(summarizeWatcherOutput('x'.repeat(80), 10), `${'x'.repeat(9)}…`)
    assert.equal(
      watcherBarSummary({ name: 'GPU' }, { status: 'ready', output: '45C' }),
      'GPU: 45C'
    )
    assert.equal(watcherBarSummary({ name: 'GPU' }, { status: 'loading' }), 'GPU: —')
    assert.equal(watcherBarSummary({ name: 'GPU' }, null), 'GPU: —')
  })

  test('toggles one watcher without touching the rest of the list', async () => {
    const { toggleWatcher } = await loadModule()
    const list = [
      { id: 'a', command: 'uptime', interval: 5, enabled: true },
      { id: 'b', command: 'df -h', interval: 5, enabled: true }
    ]
    const off = toggleWatcher(list, 'b')
    assert.deepStrictEqual(off.map(item => [item.id, item.enabled]), [
      ['a', true],
      ['b', false]
    ])
    // toggling again brings it back, and the source list is left alone
    assert.deepStrictEqual(toggleWatcher(off, 'b').map(item => item.enabled), [true, true])
    assert.deepStrictEqual(list.map(item => item.enabled), [true, true])
    // unknown ids are a no-op, malformed input still normalizes
    assert.deepStrictEqual(toggleWatcher(list, 'nope').map(item => item.enabled), [true, true])
    assert.deepStrictEqual(toggleWatcher(null, 'a'), [])
  })

  test('labels filter entries with the watcher name', async () => {
    const { watcherLabels } = await loadModule()
    assert.deepStrictEqual(watcherLabels([
      { id: 'a', name: 'GPU 0', command: 'nvidia-smi' },
      { id: 'b', name: 'disk', command: 'df -h' }
    ]), { a: 'GPU 0', b: 'disk' })
    assert.deepStrictEqual(watcherLabels([]), {})
  })
})
