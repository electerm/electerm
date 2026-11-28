export function normalizeAgentApprovalMode (value) {
  return value === 'auto' ? 'auto' : 'manual'
}

export const agentCommandLimit = 200

// Entries must round-trip as a visible single line in the settings editor.
// Keep all printable whitespace intact for the exact command comparison.
export function canRememberAgentCommand (command) {
  return typeof command === 'string' && command.trim().length > 0 &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(command)
}

export function normalizeAgentCommandAllowlist (entries) {
  return Array.isArray(entries)
    ? [...new Set(entries.filter(canRememberAgentCommand))].slice(-agentCommandLimit)
    : []
}

export function parseAgentCommandLines (text) {
  return normalizeAgentCommandAllowlist(text.split('\n').map(line => line.replace(/\r$/, '')))
}
