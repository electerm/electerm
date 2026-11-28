import { getItem, safeGetItemJSON, safeSetItemOnce } from '../../common/safe-local-storage.js'
import { normalizeAgentApprovalMode, normalizeAgentCommandAllowlist } from './agent-permissions.js'

const modeKey = 'agentApprovalMode'
const listKey = 'agentCommandAllowlist'
const changed = 'agent-permissions-changed'
// A denied removal must not reactivate the old value in this renderer.
const failedRemovals = new Set()

function removeGrant (key) {
  try {
    window.localStorage.removeItem(key)
    failedRemovals.delete(key)
  } catch {
    failedRemovals.add(key)
  }
}

// Grants are local to this app origin, outside synchronized settings. Read
// them at dispatch so a revocation in another window takes effect immediately.
export function readAgentApprovalMode () {
  try {
    if (!failedRemovals.has(modeKey)) return normalizeAgentApprovalMode(getItem(modeKey))
  } catch {}
  return 'manual'
}

export function readAgentCommandAllowlist () {
  try {
    if (!failedRemovals.has(listKey)) return normalizeAgentCommandAllowlist(safeGetItemJSON(listKey, []))
  } catch {}
  return []
}

export function setAgentApprovalMode (value) {
  if (normalizeAgentApprovalMode(value) === 'auto') {
    try {
      window.localStorage.setItem(modeKey, 'auto')
      failedRemovals.delete(modeKey)
    } catch {
      removeGrant(modeKey)
    }
  } else {
    removeGrant(modeKey)
  }
  window.dispatchEvent(new Event(changed))
}

function persistCommands (commands) {
  while (commands.length) {
    try {
      safeSetItemOnce(listKey, JSON.stringify(commands))
      failedRemovals.delete(listKey)
      return true
    } catch (err) {
      if (err?.name !== 'QuotaExceededError') return false
      // Retry with progressively fewer of the oldest entries. A single
      // oversized command still runs once if the user just approved it.
      commands = commands.slice(Math.ceil(commands.length / 2))
    }
  }
  return false
}

export function setAgentCommandAllowlist (entries) {
  const commands = normalizeAgentCommandAllowlist(entries)
  const saved = commands.length > 0 && persistCommands(commands)
  if (!saved) removeGrant(listKey)
  window.dispatchEvent(new Event(changed))
  return saved || (commands.length === 0 && !failedRemovals.has(listKey))
}

export function rememberAgentCommand (command) {
  const commands = normalizeAgentCommandAllowlist([...readAgentCommandAllowlist(), command])
  if (persistCommands(commands)) {
    window.dispatchEvent(new Event(changed))
  }
}

export function resetAgentPermissions () {
  removeGrant(modeKey)
  removeGrant(listKey)
  window.dispatchEvent(new Event(changed))
}

export function subscribeAgentPermissions (notify) {
  function onStorage (event) {
    if (event.key === null || event.key === modeKey || event.key === listKey) notify()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(changed, notify)
  }
}
