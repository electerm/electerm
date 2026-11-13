/**
 * Owner for user-defined monitor watchers.
 *
 * A watcher is just "run this command every N seconds and keep the text", so it
 * needs none of the parsing, thresholds or history the built-in groups have.
 * Keeping it out of SessionMonitor also keeps that class about the fixed
 * `REMOTE_MONITOR_COMMANDS` contract.
 *
 * One pool per session: several surfaces (the monitor bar, the info panel) can
 * watch the same command without running it twice.
 */

import { useEffect, useMemo, useState } from 'react'
import { watcherIntervalMs } from '../../common/custom-watcher.js'

// A watcher command that takes longer than this is treated as hung. It scales
// with the interval so a 60s poll is not cut off at 5s, but never runs away.
const MIN_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 60000
const MAX_BACKOFF_MS = 60000
const IDLE_CLEANUP_MS = 5 * 60 * 1000

const pools = new Map()
let subscriptionSequence = 0

async function executeRemoteCommand (sessionId, command, options) {
  const { execCmd } = await import('../terminal/terminal-apis.js')
  return execCmd(sessionId, command, options.timeoutMs, { silent: true })
}

function emptyState () {
  return {
    status: 'idle',
    output: '',
    updatedAt: null,
    error: null
  }
}

function firstLine (text) {
  return String(text || '').trim().split(/\r?\n/)[0].trim()
}

function textOf (value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function errorMessage (error) {
  if (error && error.message) {
    return error.message
  }
  return String(error)
}

// A non-zero exit code with real stdout is still worth showing (`grep` exits 1
// on "no match", `nvidia-smi` prints a warning and carries on), so stdout wins;
// stderr is only used when there is nothing else to show.
function interpretResult (result) {
  if (!result || typeof result !== 'object') {
    return { output: '', error: 'No response from command' }
  }
  const stdout = textOf(result.stdout)
  const stderr = textOf(result.stderr)
  if (result.timedOut === true) {
    return { output: stdout, error: 'Timed out' }
  }
  if (stdout) {
    return { output: stdout, error: null }
  }
  if (stderr) {
    return { output: '', error: firstLine(stderr) }
  }
  const code = result.exitCode
  if (code !== null && code !== undefined && Number(code) !== 0) {
    return { output: '', error: `Exit code ${code}` }
  }
  return { output: '', error: null }
}

function successState (interpreted) {
  return {
    status: 'ready',
    output: interpreted.output,
    error: null,
    updatedAt: Date.now()
  }
}

// A failure keeps the last good output on screen and only flags it: a one-off
// timeout should not blank a panel the user is watching.
function failureStatus (previous) {
  if (previous.output) {
    return 'stale'
  }
  return 'error'
}

function failureState (previous, interpreted) {
  if (!interpreted.output) {
    return {
      status: failureStatus(previous),
      output: previous.output,
      error: interpreted.error,
      updatedAt: previous.updatedAt
    }
  }
  return {
    status: failureStatus(previous),
    output: interpreted.output,
    error: interpreted.error,
    updatedAt: Date.now()
  }
}

function thrownState (previous, error) {
  return {
    status: failureStatus(previous),
    output: previous.output,
    error: errorMessage(error),
    updatedAt: previous.updatedAt
  }
}

// Back off on repeated failures so a broken command does not hammer the session,
// but never wait longer than MAX_BACKOFF_MS.
function nextDelayMs (runner) {
  if (!runner.failures) {
    return runner.intervalMs
  }
  return Math.min(runner.intervalMs * (2 ** runner.failures), MAX_BACKOFF_MS)
}

export class CustomWatcherPool {
  constructor (sessionId, executor) {
    this.sessionId = sessionId
    this.executor = executor || ((command, options) => executeRemoteCommand(
      this.sessionId,
      command,
      options
    ))
    this.subscriptions = new Map()
    this.runners = new Map()
    this.states = {}
    this.cleanupTimer = null
  }

  subscribe (watchers, listener) {
    const id = ++subscriptionSequence
    clearTimeout(this.cleanupTimer)
    this.cleanupTimer = null
    this.subscriptions.set(id, {
      definitions: new Map(watchers.map(watcher => [watcher.id, watcher])),
      listener
    })
    listener(this.states)
    this.reconcile()
    return () => {
      this.subscriptions.delete(id)
      this.reconcile()
      if (!this.subscriptions.size) {
        this.cleanupTimer = setTimeout(() => {
          if (!this.subscriptions.size) {
            this.destroy()
            pools.delete(this.sessionId)
          }
        }, IDLE_CLEANUP_MS)
      }
    }
  }

  requestedDefinitions () {
    const requested = new Map()
    for (const subscription of this.subscriptions.values()) {
      for (const [id, definition] of subscription.definitions) {
        requested.set(id, definition)
      }
    }
    return requested
  }

  reconcile () {
    const requested = this.requestedDefinitions()
    for (const [id, runner] of [...this.runners]) {
      const definition = requested.get(id)
      if (!definition) {
        this.stop(id)
        continue
      }
      // an edited command or interval restarts the runner with a clean slate
      if (runner.command !== definition.command ||
          runner.intervalMs !== watcherIntervalMs(definition)) {
        this.stop(id)
        this.setState(id, emptyState())
      }
    }
    for (const [id, definition] of requested) {
      this.start(id, definition)
    }
  }

  start (id, definition) {
    if (this.runners.has(id)) {
      return
    }
    const intervalMs = watcherIntervalMs(definition)
    const runner = {
      command: definition.command,
      intervalMs,
      timeoutMs: Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, intervalMs)),
      failures: 0,
      running: false,
      timer: null
    }
    this.runners.set(id, runner)
    this.run(id, runner)
  }

  stop (id) {
    const runner = this.runners.get(id)
    if (!runner) {
      return
    }
    clearTimeout(runner.timer)
    this.runners.delete(id)
  }

  setState (id, patch) {
    this.states = {
      ...this.states,
      [id]: {
        ...(this.states[id] || emptyState()),
        ...patch
      }
    }
    this.emit()
  }

  emit () {
    for (const subscription of this.subscriptions.values()) {
      subscription.listener(this.states)
    }
  }

  // Manual run for the refresh button: the interval may be minutes long.
  refresh (id) {
    const runner = this.runners.get(id)
    if (!runner) {
      return
    }
    clearTimeout(runner.timer)
    runner.failures = 0
    this.run(id, runner)
  }

  // Returns null when the runner was replaced or stopped while the command was
  // in flight: that result belongs to a watcher that no longer exists.
  async executeOnce (id, runner, previous) {
    try {
      const result = await this.executor(runner.command, { timeoutMs: runner.timeoutMs })
      if (this.runners.get(id) !== runner) {
        return null
      }
      const interpreted = interpretResult(result)
      if (!interpreted.error) {
        runner.failures = 0
        return successState(interpreted)
      }
      runner.failures += 1
      return failureState(previous, interpreted)
    } catch (error) {
      if (this.runners.get(id) !== runner) {
        return null
      }
      runner.failures += 1
      return thrownState(previous, error)
    }
  }

  async run (id, runner) {
    if (this.runners.get(id) !== runner || runner.running) {
      return
    }
    runner.running = true
    const previous = this.states[id] || emptyState()
    if (!previous.output) {
      this.setState(id, { status: 'loading', error: null })
    }
    const update = await this.executeOnce(id, runner, previous)
    if (!update) {
      return
    }
    this.setState(id, update)
    runner.running = false
    if (this.runners.get(id) !== runner) {
      return
    }
    runner.timer = setTimeout(() => this.run(id, runner), nextDelayMs(runner))
  }

  destroy () {
    clearTimeout(this.cleanupTimer)
    this.cleanupTimer = null
    for (const id of [...this.runners.keys()]) {
      this.stop(id)
    }
    this.subscriptions.clear()
    this.states = {}
  }
}

function getPool (sessionId) {
  let pool = pools.get(sessionId)
  if (!pool) {
    pool = new CustomWatcherPool(sessionId)
    pools.set(sessionId, pool)
  }
  return pool
}

export function subscribeCustomWatchers (sessionId, watchers, listener) {
  return getPool(sessionId).subscribe(watchers, listener)
}

export function refreshCustomWatcher (sessionId, id) {
  const pool = pools.get(sessionId)
  if (pool) {
    pool.refresh(id)
  }
}

function documentIsVisible () {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

export function useCustomWatchers (sessionId, watchers, enabled = true) {
  const [visible, setVisible] = useState(documentIsVisible)
  const [states, setStates] = useState({})
  // callers rebuild the array every render; key it by what actually matters so
  // the effect does not resubscribe (and restart every runner) on each pass
  const watcherKey = watchers
    .map(watcher => `${watcher.id}\u0000${watcher.command}\u0000${watcher.interval}`)
    .join('\u0001')
  const definitions = useMemo(() => watchers, [watcherKey])

  useEffect(() => {
    const onVisibilityChange = () => setVisible(documentIsVisible())
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    setStates({})
    if (!enabled || !visible || !sessionId || !definitions.length) {
      return
    }
    return subscribeCustomWatchers(sessionId, definitions, setStates)
  }, [definitions, enabled, sessionId, visible])

  return states
}
