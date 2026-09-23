import { useEffect, useMemo, useState } from 'react'
import {
  REMOTE_MONITOR_COMMANDS,
  REMOTE_MONITOR_INTERVALS,
  deriveNetworkRates,
  getUsageLevel,
  parseActivities,
  parseCpu,
  parseDisks,
  parseMemory,
  parseNetwork,
  parseSysInfo,
  parseUptime,
  parseUsers
} from './monitor-model.js'

const GROUP_NAMES = Object.keys(REMOTE_MONITOR_COMMANDS)
const monitors = new Map()

async function executeRemoteCommand (sessionId, command) {
  const { execCmd } = await import('../terminal/terminal-apis.js')
  return execCmd(sessionId, command, 5000, { silent: true })
}
let subscriptionSequence = 0

function emptyGroup () {
  return {
    status: 'idle',
    data: null,
    updatedAt: null,
    error: null
  }
}

export function createEmptyMonitorSnapshot (sessionId = '') {
  return {
    sessionId,
    groups: Object.fromEntries(GROUP_NAMES.map(name => [name, emptyGroup()])),
    cpuHistory: [],
    levels: { cpu: 'unknown', memory: 'unknown', disks: {} }
  }
}

function unsupportedResult (result) {
  if (!result || typeof result !== 'object') {
    return false
  }
  const message = `${result.stderr || ''} ${result.error || ''}`
  return result.exitCode === 126 ||
    result.exitCode === 127 ||
    /not found|unsupported|no such file/i.test(message)
}

function failedResult (result) {
  return !result ||
    typeof result !== 'object' ||
    result.timedOut === true ||
    (result.exitCode !== null && result.exitCode !== undefined && result.exitCode !== 0)
}

function parseGroup (name, results, sampleTimestamp, previousNetwork) {
  if (name === 'sysinfo') {
    return parseSysInfo(results[0], results[1])
  }
  const result = results[0]
  if (name === 'cpu') return parseCpu(result)
  if (name === 'memory') return parseMemory(result)
  if (name === 'uptime') return parseUptime(result, sampleTimestamp)
  if (name === 'users') return parseUsers(result)
  if (name === 'disks') return parseDisks(result)
  if (name === 'activities') return parseActivities(result)
  if (name === 'network') {
    const parsed = parseNetwork(result)
    if (!parsed) {
      return null
    }
    const current = {
      ...parsed,
      sampleTimestamp
    }
    return {
      data: deriveNetworkRates(previousNetwork, current, sampleTimestamp),
      raw: current
    }
  }
  return null
}

export class SessionMonitor {
  constructor (sessionId, executor) {
    this.sessionId = sessionId
    this.executor = executor || (command => executeRemoteCommand(
      this.sessionId,
      command
    ))
    this.snapshot = createEmptyMonitorSnapshot(sessionId)
    this.subscriptions = new Map()
    this.runners = new Map()
    this.networkSample = null
    this.cleanupTimer = null
  }

  subscribe (groups, listener) {
    const id = ++subscriptionSequence
    clearTimeout(this.cleanupTimer)
    this.cleanupTimer = null
    this.subscriptions.set(id, {
      groups: new Set(groups.filter(name => GROUP_NAMES.includes(name))),
      listener
    })
    listener(this.snapshot)
    this.reconcile()
    return () => {
      this.subscriptions.delete(id)
      this.reconcile()
      if (!this.subscriptions.size) {
        this.cleanupTimer = setTimeout(() => {
          if (!this.subscriptions.size) {
            this.destroy()
            monitors.delete(this.sessionId)
          }
        }, 5 * 60 * 1000)
      }
    }
  }

  requestedGroups () {
    const requested = new Set()
    for (const subscription of this.subscriptions.values()) {
      for (const group of subscription.groups) {
        requested.add(group)
      }
    }
    return requested
  }

  reconcile () {
    const requested = this.requestedGroups()
    for (const name of this.runners.keys()) {
      if (!requested.has(name)) {
        this.stopGroup(name)
      }
    }
    for (const name of requested) {
      this.startGroup(name)
    }
  }

  startGroup (name) {
    if (this.runners.has(name)) {
      return
    }
    const current = this.snapshot.groups[name]
    if (REMOTE_MONITOR_INTERVALS[name] === 0 && current.status === 'ready') {
      return
    }
    if (current.status === 'unsupported') {
      return
    }
    const runner = {
      timer: null,
      failures: 0
    }
    this.runners.set(name, runner)
    this.runGroup(name, runner)
  }

  stopGroup (name) {
    const runner = this.runners.get(name)
    if (!runner) {
      return
    }
    clearTimeout(runner.timer)
    this.runners.delete(name)
    if (name === 'network') {
      this.networkSample = null
    }
  }

  updateGroup (name, update) {
    this.snapshot = {
      ...this.snapshot,
      groups: {
        ...this.snapshot.groups,
        [name]: {
          ...this.snapshot.groups[name],
          ...update
        }
      }
    }
    this.emit()
  }

  emit () {
    for (const subscription of this.subscriptions.values()) {
      subscription.listener(this.snapshot)
    }
  }

  async execute (command) {
    return this.executor(command)
  }

  async runGroup (name, runner) {
    if (this.runners.get(name) !== runner) {
      return
    }
    const previous = this.snapshot.groups[name]
    if (previous.data === null || previous.data === undefined) {
      this.updateGroup(name, {
        status: 'loading',
        error: null
      })
    }
    let unsupported = false
    try {
      const commands = Array.isArray(REMOTE_MONITOR_COMMANDS[name])
        ? REMOTE_MONITOR_COMMANDS[name]
        : [REMOTE_MONITOR_COMMANDS[name]]
      const results = []
      for (const command of commands) {
        const result = await this.execute(command)
        if (this.runners.get(name) !== runner) {
          return
        }
        if (failedResult(result)) {
          unsupported = unsupportedResult(result)
          const error = new Error(result?.timedOut
            ? 'Remote monitor command timed out'
            : result?.stderr || 'Remote monitor command failed')
          error.result = result
          throw error
        }
        results.push(result)
      }
      const sampleTimestamp = Date.now()
      const parsed = parseGroup(name, results, sampleTimestamp, this.networkSample)
      const data = name === 'network' ? parsed?.data : parsed
      if (name === 'network' && parsed?.raw) {
        this.networkSample = parsed.raw
      }
      if (data === null || data === undefined) {
        throw new Error('Remote monitor response could not be parsed')
      }
      runner.failures = 0
      let cpuHistory = this.snapshot.cpuHistory
      if (name === 'cpu' && Number.isFinite(data)) {
        cpuHistory = [
          ...cpuHistory,
          { timestamp: sampleTimestamp, value: data }
        ].slice(-60)
      }
      const levels = { ...this.snapshot.levels }
      if (name === 'cpu') levels.cpu = getUsageLevel(data, levels.cpu)
      if (name === 'memory') levels.memory = getUsageLevel(data.percent, levels.memory)
      if (name === 'disks') {
        levels.disks = Object.fromEntries(data.map(disk => [
          disk.mount, getUsageLevel(disk.percent, levels.disks[disk.mount])
        ]))
      }
      this.snapshot = {
        ...this.snapshot,
        levels,
        cpuHistory,
        groups: {
          ...this.snapshot.groups,
          [name]: {
            status: 'ready',
            data,
            updatedAt: sampleTimestamp,
            error: null
          }
        }
      }
      this.emit()
    } catch (error) {
      if (this.runners.get(name) !== runner) {
        return
      }
      runner.failures += 1
      this.updateGroup(name, {
        status: unsupported
          ? 'unsupported'
          : previous.data !== null && previous.data !== undefined
            ? 'stale'
            : 'error',
        error: error.message || String(error)
      })
      if (unsupported) {
        this.stopGroup(name)
        return
      }
    }
    if (this.runners.get(name) !== runner) {
      return
    }
    const interval = REMOTE_MONITOR_INTERVALS[name]
    if (interval > 0 || runner.failures > 0) {
      const baseInterval = interval || 5000
      const backoff = Math.min(baseInterval * (2 ** runner.failures), 60000)
      runner.timer = setTimeout(() => this.runGroup(name, runner), backoff)
    } else {
      this.runners.delete(name)
    }
  }

  destroy () {
    clearTimeout(this.cleanupTimer)
    this.cleanupTimer = null
    for (const name of [...this.runners.keys()]) {
      this.stopGroup(name)
    }
    this.subscriptions.clear()
    this.networkSample = null
  }
}

function getSessionMonitor (sessionId) {
  let monitor = monitors.get(sessionId)
  if (!monitor) {
    monitor = new SessionMonitor(sessionId)
    monitors.set(sessionId, monitor)
  }
  return monitor
}

export function subscribeRemoteMonitor (sessionId, groups, listener) {
  return getSessionMonitor(sessionId).subscribe(groups, listener)
}

function documentIsVisible () {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

export function useRemoteMonitor (sessionId, groups, enabled = true) {
  const [visible, setVisible] = useState(documentIsVisible)
  const [snapshot, setSnapshot] = useState(() => createEmptyMonitorSnapshot(sessionId))
  const groupKey = useMemo(() => [...new Set(groups)].sort().join(','), [groups])

  useEffect(() => {
    const onVisibilityChange = () => setVisible(documentIsVisible())
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    setSnapshot(createEmptyMonitorSnapshot(sessionId))
    if (!enabled || !visible || !sessionId || !groupKey) {
      return
    }
    return subscribeRemoteMonitor(
      sessionId,
      groupKey.split(',').filter(Boolean),
      setSnapshot
    )
  }, [enabled, groupKey, sessionId, visible])

  return snapshot.sessionId === sessionId
    ? snapshot
    : createEmptyMonitorSnapshot(sessionId)
}
