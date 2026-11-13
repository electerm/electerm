const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadModule = () => import('../../client/components/remote-monitor/custom-watcher-pool.js')
const turn = () => new Promise(resolve => setImmediate(resolve))

function deferred () {
  let resolvePending
  const promise = new Promise(resolve => { resolvePending = resolve })
  return { promise, resolve: resolvePending }
}

// 60s so a test never races the next scheduled run; the timer is cleared by
// destroy() at the end of each case
const watcher = (over = {}) => ({
  id: 'custom-gpu',
  name: 'GPU',
  command: 'nvidia-smi -i 0',
  interval: 60,
  ...over
})

const ok = stdout => ({ stdout, stderr: '', exitCode: 0, timedOut: false })

describe('custom watcher pool', () => {
  test('runs the command on subscribe and publishes its output', async () => {
    const { CustomWatcherPool } = await loadModule()
    const calls = []
    const pool = new CustomWatcherPool('session-a', command => {
      calls.push(command)
      return Promise.resolve(ok('GPU 0: 45C\nsecond line'))
    })
    const states = []
    const off = pool.subscribe([watcher()], snapshot => states.push(snapshot))
    await turn()
    assert.deepStrictEqual(calls, ['nvidia-smi -i 0'])
    assert.equal(states[0]['custom-gpu'], undefined)
    assert.equal(pool.states['custom-gpu'].status, 'ready')
    assert.equal(pool.states['custom-gpu'].output, 'GPU 0: 45C\nsecond line')
    assert.equal(typeof pool.states['custom-gpu'].updatedAt, 'number')
    off()
    pool.destroy()
  })

  test('shares one run between subscribers of the same watcher', async () => {
    const { CustomWatcherPool } = await loadModule()
    const pending = deferred()
    const calls = []
    const pool = new CustomWatcherPool('session-b', command => {
      calls.push(command)
      return pending.promise
    })
    const off1 = pool.subscribe([watcher()], () => {})
    const off2 = pool.subscribe([watcher()], () => {})
    pending.resolve(ok('45C'))
    await turn()
    assert.equal(calls.length, 1)
    assert.equal(pool.states['custom-gpu'].output, '45C')
    off1()
    off2()
    assert.equal(pool.runners.size, 0)
    pool.destroy()
  })

  test('restarts with the new command and drops the old output', async () => {
    const { CustomWatcherPool } = await loadModule()
    const calls = []
    const pool = new CustomWatcherPool('session-c', command => {
      calls.push(command)
      return Promise.resolve(ok(`out:${command}`))
    })
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].output, 'out:nvidia-smi -i 0')
    const off2 = pool.subscribe([watcher({ command: 'uptime' })], () => {})
    await turn()
    assert.deepStrictEqual(calls, ['nvidia-smi -i 0', 'uptime'])
    assert.equal(pool.states['custom-gpu'].output, 'out:uptime')
    off()
    off2()
    pool.destroy()
  })

  test('reports a failing command but keeps the last good output', async () => {
    const { CustomWatcherPool } = await loadModule()
    let next = ok('45C')
    const pool = new CustomWatcherPool('session-d', () => Promise.resolve(next))
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].status, 'ready')
    next = { stdout: '', stderr: 'nvidia-smi: command not found\nmore', exitCode: 127 }
    pool.refresh('custom-gpu')
    await turn()
    assert.equal(pool.states['custom-gpu'].status, 'stale')
    assert.equal(pool.states['custom-gpu'].output, '45C')
    assert.equal(pool.states['custom-gpu'].error, 'nvidia-smi: command not found')
    off()
    pool.destroy()
  })

  test('a first run that fails has no output to fall back to', async () => {
    const { CustomWatcherPool } = await loadModule()
    const pool = new CustomWatcherPool('session-e', () => Promise.resolve({
      stdout: '', stderr: '', exitCode: 9
    }))
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].status, 'error')
    assert.equal(pool.states['custom-gpu'].error, 'Exit code 9')
    assert.equal(pool.states['custom-gpu'].updatedAt, null)
    off()
    pool.destroy()
  })

  test('stdout wins over a non-zero exit code', async () => {
    const { CustomWatcherPool } = await loadModule()
    const pool = new CustomWatcherPool('session-f', () => Promise.resolve({
      stdout: 'no match\n', stderr: '', exitCode: 1
    }))
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].status, 'ready')
    assert.equal(pool.states['custom-gpu'].output, 'no match')
    off()
    pool.destroy()
  })

  test('a thrown executor error becomes a readable error state', async () => {
    const { CustomWatcherPool } = await loadModule()
    const pool = new CustomWatcherPool('session-g', () => Promise.reject(new Error('channel closed')))
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].status, 'error')
    assert.equal(pool.states['custom-gpu'].error, 'channel closed')
    off()
    pool.destroy()
  })

  test('refresh runs again without waiting for the interval', async () => {
    const { CustomWatcherPool } = await loadModule()
    let count = 0
    const pool = new CustomWatcherPool('session-h', () => {
      count += 1
      return Promise.resolve(ok(`run ${count}`))
    })
    const off = pool.subscribe([watcher()], () => {})
    await turn()
    assert.equal(pool.states['custom-gpu'].output, 'run 1')
    pool.refresh('custom-gpu')
    await turn()
    assert.equal(pool.states['custom-gpu'].output, 'run 2')
    off()
    pool.destroy()
  })
})
