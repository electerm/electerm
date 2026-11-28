import { getItem, safeGetItemJSON, safeSetItemOnce } from '../../common/safe-local-storage.js'
import { normalizeAgentApprovalMode, normalizeAgentCommandAllowlist } from './agent-permissions.js'

export const permissionSaveError = 'Couldn’t save this permission setting.'

const modeKey = 'agentApprovalMode'
const listKey = 'agentCommandAllowlist'
const changed = 'agent-permissions-changed'
// A denied removal must not reactivate the old value in this renderer.
const failedRemovals = new Set()

function removeGrant (key) {
  try {
    window.localStorage.removeItem(key)
    failedRemovals.delete(key)
    return true
  } catch {
    failedRemovals.add(key)
    return false
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
    return storedCommands()
  } catch {}
  return []
}

function storedCommands () {
  if (failedRemovals.has(listKey)) return []
  return normalizeAgentCommandAllowlist(safeGetItemJSON(listKey, []))
}

export function setAgentApprovalMode (value) {
  let saved
  if (normalizeAgentApprovalMode(value) === 'auto') {
    try {
      window.localStorage.setItem(modeKey, 'auto')
      failedRemovals.delete(modeKey)
      saved = true
    } catch {
      // Grant auto approval only after it has actually been persisted.
      removeGrant(modeKey)
      saved = false
    }
  } else {
    saved = removeGrant(modeKey)
  }
  window.dispatchEvent(new Event(changed))
  return saved
}

function persistCommands (commands) {
  try {
    safeSetItemOnce(listKey, JSON.stringify(commands))
    failedRemovals.delete(listKey)
    return true
  } catch {
    return false
  }
}

export function setAgentCommandAllowlist (entries) {
  const commands = normalizeAgentCommandAllowlist(entries)
  const saved = commands.length ? persistCommands(commands) : removeGrant(listKey)
  if (!saved && commands.length) {
    // A failed addition must preserve existing grants. A failed replacement
    // must still revoke entries the user has explicitly removed.
    try {
      const previous = storedCommands()
      const retained = previous.filter(command => commands.includes(command))
      if (retained.length < previous.length && (!retained.length || !persistCommands(retained))) {
        removeGrant(listKey)
      }
    } catch {
      removeGrant(listKey)
    }
  }
  window.dispatchEvent(new Event(changed))
  return saved
}

export function rememberAgentCommand (command) {
  // Do not overwrite a list we could not read, or discard older grants on quota failure.
  try {
    const commands = normalizeAgentCommandAllowlist([...storedCommands(), command])
    if (!persistCommands(commands)) return false
  } catch { return false }
  window.dispatchEvent(new Event(changed))
  return true
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
