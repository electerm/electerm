// i18n helper for trigger keys.
// Locales live in the external @electerm/electerm-locales package, so newly
// added keys have no translation yet and window.translate falls back to the
// raw key. Provide English fallbacks until the locales package is updated.
const fallbacks = {
  trigger: 'Triggers',
  triggerMatch: 'Match',
  triggerAction: 'Action',
  triggerSendEnter: 'Send Enter',
  triggerMode: 'Mode',
  triggerCooldown: 'Cooldown (ms)',
  triggerPreset: 'Presets',
  triggerEmpty: 'No triggers yet — add one or pick a preset',
  triggerSession: 'This session',
  triggerGlobal: 'Global',
  triggerPredefined: 'Predefined',
  triggerPredefinedHint: 'Switches apply to the current session only — global defaults are not changed. Edit global defaults via Manage.',
  triggerGlobalOn: 'global: on',
  triggerGlobalOff: 'global: off',
  triggerSessionHint: 'Only applies to the current terminal. Temporary rules (including copies of bookmark triggers) are never saved to the triggers database.',
  triggerGlobalHint: 'All predefined triggers. Switches change the global on/off default — stored in the database and synced.',
  triggerManage: 'Manage',
  triggerJsonHint: 'JSON array of trigger rules. Invalid regex or missing match will be rejected.',
  enabled: 'Enabled',
  caseSensitive: 'Case sensitive',
  notifyOnly: 'Notify only (no send)',
  unnamed: 'Unnamed'
}

export function te (key) {
  const v = window.translate(key)
  if (v !== key && v !== window.capitalizeFirstLetter(key)) {
    return v
  }
  return fallbacks[key] || v
}
