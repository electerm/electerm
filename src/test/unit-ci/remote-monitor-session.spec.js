const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = global.window || {}
global.window.et = global.window.et || { wsOpened: false }
global.window.pre = global.window.pre || { ipcOnEvent () {} }
global.window.store = global.window.store || {}

const loadModule = () => import('../../client/components/remote-monitor/session-monitor.js')
const turn = () => new Promise(resolve => setImmediate(resolve))

function deferred () {
  let resolvePending
  const promise = new Promise(resolve => { resolvePending = resolve })
  return { promise, resolve: resolvePending }
}

const cpuResult = {
  stdout: [
    'cpu 100 0 100 800 0 0 0 0 0 0',
    'cpu 120 0 110 870 0 0 0 0 0 0'
  ].join('\n'),
  stderr: '',
  exitCode: 0,
  timedOut: false
}

describe('shared remote monitor session owner', () => {
  test('deduplicates a requested group across subscribers', async () => {
    const pending = deferred()
    const commands = []
    const { SessionMonitor } = await loadModule()
    const monitor = new SessionMonitor('session-a', command => {
      commands.push(command)
      return pending.promise
    })
    const snapshots = []
    const off1 = monitor.subscribe(['cpu'], snapshot => snapshots.push(snapshot))
    const off2 = monitor.subscribe(['cpu'], () => {})

    await turn()
    assert.equal(commands.length, 1)
    pending.resolve(cpuResult)
    await turn()
    assert.equal(snapshots.at(-1).groups.cpu.status, 'ready')
    assert.ok(Number.isFinite(snapshots.at(-1).groups.cpu.data))

    off1()
    off2()
    monitor.destroy()
  })

  test('preserves usage thresholds when switching between bar and panel subscriptions', async () => {
    const { SessionMonitor } = await loadModule()
    let cpu = 95
    const monitor = new SessionMonitor('session-handoff', async () => ({ ...cpuResult, stdout: `CPU ${cpu}%` }))
    const offBar = monitor.subscribe(['cpu'], () => {})
    await turn()
    assert.equal(monitor.snapshot.levels.cpu, 'critical')
    offBar()
    cpu = 87
    const offPanel = monitor.subscribe(['cpu'], () => {})
    await turn()
    assert.equal(monitor.snapshot.groups.cpu.data, 87)
    assert.equal(monitor.snapshot.levels.cpu, 'critical')
    offPanel()
    monitor.destroy()
  })

  test('starts activity only when an activity subscriber exists', async () => {
    const commands = []
    const { SessionMonitor } = await loadModule()
    const monitor = new SessionMonitor('session-b', async command => {
      commands.push(command)
      if (command.startsWith('ps ')) {
        return {
          stdout: '1 root 3.0 100 init',
          stderr: '',
          exitCode: 0,
          timedOut: false
        }
      }
      return cpuResult
    })
    const offCpu = monitor.subscribe(['cpu'], () => {})
    await turn()
    assert.equal(commands.some(command => command.startsWith('ps ')), false)

    const offActivity = monitor.subscribe(['activities'], () => {})
    await turn()
    assert.equal(commands.some(command => command.startsWith('ps ')), true)

    offCpu()
    offActivity()
    monitor.destroy()
  })

  test('retries one-shot system info after a transient failure', async () => {
    const { SessionMonitor } = await loadModule()
    const monitor = new SessionMonitor('session-sysinfo-retry', async () => ({
      stdout: '',
      stderr: 'temporary failure',
      exitCode: 1,
      timedOut: false
    }))
    const off = monitor.subscribe(['sysinfo'], () => {})

    await turn()
    await turn()
    assert.equal(monitor.snapshot.groups.sysinfo.status, 'error')
    assert.equal(monitor.runners.get('sysinfo').failures, 1)
    assert.ok(monitor.runners.get('sysinfo').timer)

    off()
    monitor.destroy()
  })

  test('ignores an in-flight response after the final unsubscribe', async () => {
    const pending = deferred()
    const { SessionMonitor } = await loadModule()
    const monitor = new SessionMonitor('session-c', () => pending.promise)
    const snapshots = []
    const off = monitor.subscribe(['cpu'], snapshot => snapshots.push(snapshot))
    await turn()
    off()
    const countAfterStop = snapshots.length

    pending.resolve(cpuResult)
    await turn()
    await turn()
    assert.equal(snapshots.length, countAfterStop)
    assert.notEqual(monitor.snapshot.groups.cpu.status, 'ready')

    monitor.destroy()
  })

  test('does not continue an obsolete system-info request after resubscribing', async () => {
    const { SessionMonitor } = await loadModule()
    const pending = deferred()
    const commands = []
    const monitor = new SessionMonitor('session-restart', command => {
      commands.push(command)
      return pending.promise
    })
    const off = monitor.subscribe(['sysinfo'], () => {})
    off()
    const offNew = monitor.subscribe(['cpu'], () => {})
    pending.resolve(cpuResult)
    await turn()
    assert.equal(commands.length, 2)
    assert.notEqual(monitor.snapshot.groups.sysinfo.status, 'ready')
    assert.equal(monitor.snapshot.groups.cpu.status, 'ready')
    offNew()
    monitor.destroy()
  })
})
