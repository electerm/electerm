import { getItem, setItem, safeGetItemJSON, safeSetItemJSON } from '../../common/safe-local-storage'
import { normalizeAgentApprovalMode, normalizeAgentCommandAllowlist } from './agent-permissions'

const modeKey = 'agentApprovalMode'
const listKey = 'agentCommandAllowlist'
const changed = 'agent-permissions-changed'

// Grants are local to this app origin, outside synchronized settings. Read
// them at dispatch so a revocation in another window takes effect immediately.
export function readAgentApprovalMode () {
  return normalizeAgentApprovalMode(getItem(modeKey))
}

export function readAgentCommandAllowlist () {
  return normalizeAgentCommandAllowlist(safeGetItemJSON(listKey, []))
}

export function setAgentApprovalMode (value) {
  setItem(modeKey, normalizeAgentApprovalMode(value))
  window.dispatchEvent(new Event(changed))
}

export function setAgentCommandAllowlist (entries) {
  safeSetItemJSON(listKey, normalizeAgentCommandAllowlist(entries))
  window.dispatchEvent(new Event(changed))
}

export function rememberAgentCommand (command) {
  setAgentCommandAllowlist([...readAgentCommandAllowlist(), command])
}

export function resetAgentPermissions () {
  window.localStorage.removeItem(modeKey)
  window.localStorage.removeItem(listKey)
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
