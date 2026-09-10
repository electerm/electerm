const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let model

before(async () => {
  model = await import('../../client/components/remote-monitor/monitor-model.js')
})

describe('remote monitor item configuration', () => {
  test('has the nine stable default items in ADR order', () => {
    assert.deepStrictEqual(model.REMOTE_MONITOR_ITEM_IDS, [
      'hostname', 'cpu', 'cpuHistory', 'memory', 'upload', 'download',
      'uptime', 'users', 'disks'
    ])
    assert.deepStrictEqual(model.DEFAULT_REMOTE_MONITOR_ITEMS, model.REMOTE_MONITOR_ITEM_IDS.map(id => ({ id, enabled: true })))
  })

  test('normalizes unknown and duplicate entries and appends missing items disabled', () => {
    const items = model.normalizeRemoteMonitorItems([
      { id: 'memory', enabled: false },
      { id: 'memory', enabled: true },
      { id: 'not-a-monitor', enabled: true },
      'cpu'
    ])
    assert.deepStrictEqual(items.slice(0, 2), [
      { id: 'memory', enabled: false },
      { id: 'cpu', enabled: true }
    ])
    assert.deepStrictEqual(items.slice(2), [
      { id: 'hostname', enabled: false },
      { id: 'cpuHistory', enabled: false },
      { id: 'upload', enabled: false },
      { id: 'download', enabled: false },
      { id: 'uptime', enabled: false },
      { id: 'users', enabled: false },
      { id: 'disks', enabled: false }
    ])
  })

  test('maps saved Info panel sections to shared details without duplicating memory and swap', () => {
    assert.deepEqual(model.getInfoPanelItems(['cpu', 'mem', 'swap', 'network', 'activities', 'users', 'unknown']),
      ['hostname', 'cpu', 'memory', 'activities', 'network', 'users'])
    assert.deepEqual(model.getInfoPanelItems(['swap']), ['hostname', 'swap'])
    assert.deepEqual(model.getInfoPanelItems([]), ['hostname'])
  })

  test('keeps explicit empty configuration as all disabled, not default enabled', () => {
    const items = model.normalizeRemoteMonitorItems([])
    assert.equal(items.length, 9)
    assert.equal(items.every(item => item.enabled === false), true)
    assert.deepStrictEqual(model.normalizeRemoteMonitorItems(undefined), model.DEFAULT_REMOTE_MONITOR_ITEMS)
    assert.deepStrictEqual(model.normalizeRemoteMonitorItems(null), model.DEFAULT_REMOTE_MONITOR_ITEMS)
  })
})

describe('remote monitor command contract', () => {
  test('uses fixed read-only Linux commands and ADR intervals', () => {
    const commands = model.REMOTE_MONITOR_COMMANDS
    assert.deepStrictEqual(Object.keys(commands), [
      'sysinfo', 'cpu', 'memory', 'network', 'uptime', 'users', 'disks', 'activities'
    ])
    const text = JSON.stringify(commands)
    assert.equal(/sudo|kill|rm\s|shutdown|reboot/.test(text), false)
    assert.equal(commands.disks, 'df -Pk')
    assert.equal(commands.users, 'who')
    assert.match(commands.network, /n=\$\{d##\*\/\}/)
    assert.match(commands.network, /\[ -d "\$d" \] \|\| continue/)
    assert.match(commands.network, /\[ -d \/sys\/class\/net \] \|\| exit 127/)
    assert.equal(model.REMOTE_MONITOR_INTERVALS.cpu, 5000)
    assert.equal(model.REMOTE_MONITOR_INTERVALS.users, 30000)
    assert.equal(model.REMOTE_MONITOR_INTERVALS.disks, 10000)
  })
})

describe('remote monitor parsers', () => {
  test('parses sysinfo and Darwin naming', () => {
    assert.deepStrictEqual(model.parseSysInfo('Darwin host 23.1.0 arm64', ''), {
      os: 'macOS', sysname: 'Darwin', hostname: 'host', kernel: '23.1.0', arch: 'arm64'
    })
    assert.equal(model.parseSysInfo('bad input'), null)
  })

  test('parses aggregate CPU samples as a bounded percentage', () => {
    const text = [
      'cpu 100 0 20 80 0 0 0 0 0 0',
      'cpu 150 0 30 120 0 0 0 0 0 0'
    ].join('\n')
    assert.equal(model.parseCpu(text), 60)
    const guestCounters = [
      'cpu 100 0 20 80 0 0 0 0 50 0',
      'cpu 150 0 30 120 0 0 0 0 100 0'
    ].join('\n')
    assert.equal(model.parseCpu(guestCounters), 60)
    assert.equal(model.parseCpu('CPU 125%'), 100)
    assert.equal(model.parseCpu('cpu nope'), null)
  })

  test('uses MemAvailable for used-memory semantics and marks fallback mode', () => {
    const result = model.parseMemory([
      'MemTotal:       8192 kB',
      'MemFree:        2048 kB',
      'MemAvailable:   4096 kB',
      'SwapTotal:      1024 kB',
      'SwapFree:        512 kB'
    ].join('\n'))
    assert.deepStrictEqual(result, {
      totalBytes: 8388608,
      availableBytes: 4194304,
      usedBytes: 4194304,
      freeBytes: 2097152,
      swapTotalBytes: 1048576,
      swapUsedBytes: 524288,
      percent: 50,
      compatibilityMode: false
    })
    const fallback = model.parseMemory('MemTotal: 100 kB\nMemFree: 25 kB')
    assert.equal(fallback.availableBytes, 25 * 1024)
    assert.equal(fallback.usedBytes, 75 * 1024)
    assert.equal(fallback.compatibilityMode, true)
    assert.equal(model.parseMemory(''), null)
  })

  test('parses uptime with an optional sample timestamp', () => {
    assert.deepStrictEqual(model.parseUptime('90.5 123.0\n', 100000), {
      seconds: 90.5,
      bootTime: 9500
    })
    assert.deepStrictEqual(model.parseUptime('90.5'), { seconds: 90.5, bootTime: null })
    assert.equal(model.parseUptime('not uptime'), null)
  })

  test('parses network counters and selects the default or stable fallback', () => {
    const network = model.parseNetwork([
      'default\teth0',
      'iface\tlo\tstate=up\tipv4=127.0.0.1\trx=1\ttx=2',
      'iface\teth0\tstate=up\tipv4=192.0.2.5/24\trx=100\ttx=200',
      'iface\tens3\tstate=down\tipv4=\trx=500\ttx=700'
    ].join('\n'))
    assert.equal(network.defaultInterface, 'eth0')
    assert.equal(model.selectPrimaryNetwork(network).name, 'eth0')
    assert.equal(network.interfaces[1].ipv4, '192.0.2.5')
    const fallback = model.parseNetwork('iface\tens3\trx=1\ttx=2\niface\teth0\trx=3\ttx=4')
    assert.equal(model.selectPrimaryNetwork(fallback).name, 'ens3')
    const activeFallback = model.parseNetwork([
      'iface\tens3\tstate=down\trx=1\ttx=2',
      'iface\teth0\tstate=up\trx=3\ttx=4'
    ].join('\n'))
    assert.equal(model.selectPrimaryNetwork(activeFallback).name, 'eth0')
    assert.equal(model.parseNetwork(''), null)
  })

  test('parses users with duplicate sessions but an unknown distinction', () => {
    const users = model.parseUsers([
      'alice pts/0 2026-09-08 10:00 (192.0.2.1)',
      'alice pts/1 2026-09-08 11:00 (192.0.2.2)',
      'bob pts/2 2026-09-08 11:30'
    ].join('\n'))
    assert.deepStrictEqual(users.users, ['alice', 'bob'])
    assert.equal(users.sessions.length, 3)
    assert.deepStrictEqual(model.parseUsers(''), { users: [], sessions: [] })
    assert.equal(model.parseUsers('garbage'), null)
  })

  test('parses disks, filters pseudo filesystems, preserves root overlay and spaces', () => {
    const disks = model.parseDisks([
      'Filesystem     1024-blocks     Used Available Capacity Mounted on',
      'overlay              1000       200        800      20% /',
      'overlay               900       100        800      12% /var/lib/container',
      'tmpfs                 500         1        499       1% /run',
      '/dev/sda2            2000      1000       1000      50% /home/My\\040Data',
      'proc                  1000         0       1000       0% /proc'
    ].join('\n'))
    assert.equal(disks.length, 2)
    assert.deepStrictEqual(disks[0], {
      filesystem: 'overlay',
      totalBytes: 1024000,
      usedBytes: 204800,
      availableBytes: 819200,
      percent: 20,
      mount: '/'
    })
    assert.equal(disks[1].mount, '/home/My Data')
    assert.equal(model.parseDisks(String.raw`/dev/sda 100 50 50 50% /tab\011back\134slash`)[0].mount, '/tab\tback\\slash')
    assert.equal(model.parseDisks(''), null)
  })

  test('sorts activities numerically by CPU and reports RSS bytes', () => {
    const activities = model.parseActivities([
      'PID USER %CPU RSS COMMAND',
      '10 alice 9.5 100 sleep 10',
      '11 bob 80 200 busy',
      '12 carol 12 50 medium'
    ].join('\n'))
    assert.deepStrictEqual(activities.map(item => item.pid), [11, 12, 10])
    assert.equal(activities[0].memBytes, 200 * 1024)
    assert.equal(model.parseActivities('garbage'), null)
  })
})

describe('remote monitor rate and visual helpers', () => {
  const firstNetwork = {
    defaultInterface: 'eth0',
    sampleTimestamp: 1000,
    interfaces: [
      { name: 'eth0', ipv4: '192.0.2.1', state: 'up', rxBytes: 100, txBytes: 200 }
    ]
  }

  test('derives TX upload and RX download using actual elapsed milliseconds', () => {
    const first = model.deriveNetworkRates(null, firstNetwork)
    assert.equal(first.interfaces[0].rxRate, null)
    const second = model.deriveNetworkRates(firstNetwork, {
      ...firstNetwork,
      sampleTimestamp: 3000,
      interfaces: [{ ...firstNetwork.interfaces[0], rxBytes: 2100, txBytes: 1200 }]
    })
    assert.equal(second.interfaces[0].rxRate, 1000)
    assert.equal(second.interfaces[0].txRate, 500)
    assert.equal(second.reset, false)
  })

  test('resets rates on counter rollback and primary-interface change', () => {
    const rollback = model.deriveNetworkRates(firstNetwork, {
      ...firstNetwork,
      sampleTimestamp: 3000,
      interfaces: [{ ...firstNetwork.interfaces[0], rxBytes: 90, txBytes: 190 }]
    })
    assert.equal(rollback.reset, true)
    assert.equal(rollback.interfaces[0].rxRate, null)
    const switched = model.deriveNetworkRates(firstNetwork, {
      defaultInterface: 'wlan0',
      sampleTimestamp: 3000,
      interfaces: [
        { ...firstNetwork.interfaces[0], rxBytes: 2100, txBytes: 1200 },
        { name: 'wlan0', ipv4: null, state: 'up', rxBytes: 10, txBytes: 20 }
      ]
    })
    assert.equal(switched.reset, true)
    assert.equal(switched.resetReason, 'interface-changed')
    assert.equal(switched.interfaces.every(item => item.rxRate === null && item.txRate === null), true)
  })

  test('applies exact entry and recovery hysteresis thresholds', () => {
    assert.equal(model.getUsageLevel(79.99), 'normal')
    assert.equal(model.getUsageLevel(80), 'warning')
    assert.equal(model.getUsageLevel(90), 'critical')
    assert.equal(model.getUsageLevel(85, 'critical'), 'critical')
    assert.equal(model.getUsageLevel(84.99, 'critical'), 'warning')
    assert.equal(model.getUsageLevel(75, 'warning'), 'warning')
    assert.equal(model.getUsageLevel(74.99, 'warning'), 'normal')
    assert.equal(model.getUsageLevel(null), 'unknown')
  })

  test('formats bytes, rates and durations compactly', () => {
    assert.equal(model.formatBytes(1536), '1.5 KiB')
    assert.equal(model.formatRate(2048), '2 KiB/s')
    assert.equal(model.formatDuration(93784), '1d 02h 03m 04s')
    assert.equal(model.formatBytes(null), '—')
  })
})
