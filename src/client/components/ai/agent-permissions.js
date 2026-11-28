export function normalizeAgentApprovalMode (value) {
  return value === 'auto' ? 'auto' : 'manual'
}

// Entries must round-trip as a visible single line in the settings editor.
// Keep all printable whitespace intact for the exact command comparison.
export function canRememberAgentCommand (command) {
  return typeof command === 'string' && command.trim().length > 0 &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(command)
}

export function normalizeAgentCommandAllowlist (entries) {
  return Array.isArray(entries)
    ? [...new Set(entries.filter(canRememberAgentCommand))]
    : []
}

// The language package is released separately. Unknown keys otherwise appear
// as camelCase identifiers in the dialog and settings.
export function agentPermissionLabel (key, fallback) {
  return window.getLang?.()?.[key] ? window.translate(key) : fallback
}
