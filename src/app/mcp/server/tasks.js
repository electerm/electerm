/**
 * MCP Tasks extension (SEP-2663) — server-side task lifecycle manager.
 *
 * A Task is a durable handle for a long-running tool call. The server
 * decides per-request whether to materialize a task; clients poll with
 * tasks/get and may send tasks/cancel. Status machine:
 *
 *   working ──► completed (task.result set)
 *         ──► failed    (task.error set)
 *         ──► cancelled (cooperative; work may not stop)
 *
 * `input_required` and tasks/update are intentionally not implemented (v1).
 * tasks/list is intentionally not implemented — without an authorization
 * context per SEP-2663 guidance, listing tasks is unsafe.
 *
 * Hooks (all optional, async):
 *   onGet(task)    — refresh a working task's state before returning it
 *   onCancel(task) — perform the real cancellation (kill remote process)
 *   onSweep(task)  — clean up resources when a terminal task is swept
 */

const uid = require('../../common/uid')

const STATUS = {
  working: 'working',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled'
}

const TERMINAL_STATUSES = new Set([
  STATUS.completed,
  STATUS.failed,
  STATUS.cancelled
])

class TaskManager {
  constructor (options = {}) {
    this.tasks = new Map()
    this.ttl = options.ttl > 0 ? options.ttl : 3600000
    this.pollIntervalMs = options.pollIntervalMs > 0 ? options.pollIntervalMs : 2000
    this.maxTasks = options.maxTasks > 0 ? options.maxTasks : 100
    this.onGet = null
    this.onCancel = null
    this.onSweep = null
    this._sweepTimer = setInterval(() => {
      this.sweep().catch(() => {})
    }, Math.min(this.ttl, 60000))
    if (typeof this._sweepTimer.unref === 'function') {
      this._sweepTimer.unref()
    }
  }

  // Create a task in `working` state. meta holds server-private linkage
  // (e.g. the renderer background task id) and is never sent to clients.
  create ({ toolName, meta } = {}) {
    if (this.tasks.size >= this.maxTasks) {
      this._evictOldest()
    }
    const taskId = `task-${uid()}`
    const task = {
      taskId,
      status: STATUS.working,
      createdAt: new Date().toISOString(),
      endedAt: null,
      ttl: this.ttl,
      pollIntervalMs: this.pollIntervalMs,
      statusMessage: toolName ? `Started ${toolName}` : 'Task started',
      toolName: toolName || null,
      result: null,
      error: null,
      meta: meta || {}
    }
    this.tasks.set(taskId, task)
    return task
  }

  _evictOldest () {
    // Prefer evicting the oldest terminal task; fall back to oldest overall
    let oldestTerminal = null
    let oldest = null
    for (const task of this.tasks.values()) {
      if (!oldest || task.createdAt < oldest.createdAt) oldest = task
      if (TERMINAL_STATUSES.has(task.status) &&
        (!oldestTerminal || task.createdAt < oldestTerminal.createdAt)) {
        oldestTerminal = task
      }
    }
    const victim = oldestTerminal || oldest
    if (victim) {
      this.tasks.delete(victim.taskId)
      if (this.onSweep) {
        Promise.resolve(this.onSweep(victim)).catch(() => {})
      }
    }
  }

  // tasks/get — refreshes working tasks via onGet before returning.
  // Throws on unknown task id (transport maps this to JSON-RPC -32602).
  async get (taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`)
    }
    if (task.status === STATUS.working && this.onGet) {
      await this.onGet(task)
    }
    return this.toWire(task)
  }

  // tasks/cancel — cooperative: runs the onCancel hook, then marks the
  // task cancelled. Cancelling a terminal task is a no-op per spec.
  async cancel (taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`)
    }
    if (!TERMINAL_STATUSES.has(task.status)) {
      if (this.onCancel) {
        await this.onCancel(task)
      }
      this._markCancelled(task)
    }
    return this.toWire(task)
  }

  // Mark cancelled without invoking the onCancel hook — used when the
  // underlying execution already reported a cancelled state.
  cancelLocal (taskId) {
    const task = this.tasks.get(taskId)
    if (task && !TERMINAL_STATUSES.has(task.status)) {
      this._markCancelled(task)
    }
    return task || null
  }

  _markCancelled (task) {
    task.status = STATUS.cancelled
    task.statusMessage = 'Task cancelled'
    task.endedAt = new Date().toISOString()
  }

  complete (taskId, result) {
    const task = this.tasks.get(taskId)
    if (!task || TERMINAL_STATUSES.has(task.status)) {
      return task || null
    }
    task.status = STATUS.completed
    task.statusMessage = 'Task completed'
    task.result = result
    task.endedAt = new Date().toISOString()
    return task
  }

  fail (taskId, message) {
    const task = this.tasks.get(taskId)
    if (!task || TERMINAL_STATUSES.has(task.status)) {
      return task || null
    }
    task.status = STATUS.failed
    task.statusMessage = 'Task failed'
    task.error = {
      code: -32603,
      message: message || 'Task execution failed'
    }
    task.endedAt = new Date().toISOString()
    return task
  }

  // Client-facing wire shape — never leaks server-private `meta`.
  toWire (task) {
    const wire = {
      taskId: task.taskId,
      status: task.status,
      createdAt: task.createdAt,
      ttl: task.ttl,
      pollIntervalMs: task.pollIntervalMs,
      statusMessage: task.statusMessage
    }
    if (task.status === STATUS.completed && task.result !== null) {
      wire.result = task.result
    }
    if (task.status === STATUS.failed && task.error) {
      wire.error = task.error
    }
    return wire
  }

  // Remove terminal tasks whose retention TTL has expired.
  async sweep () {
    const now = Date.now()
    for (const task of Array.from(this.tasks.values())) {
      if (!TERMINAL_STATUSES.has(task.status) || !task.endedAt) {
        continue
      }
      if (now - Date.parse(task.endedAt) > this.ttl) {
        this.tasks.delete(task.taskId)
        if (this.onSweep) {
          try {
            await this.onSweep(task)
          } catch (_) {
            // best-effort cleanup
          }
        }
      }
    }
  }

  destroy () {
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer)
      this._sweepTimer = null
    }
    this.tasks.clear()
  }
}

module.exports = { TaskManager, STATUS, TERMINAL_STATUSES }
