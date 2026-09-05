// Built-in trigger presets users can pick from.
// send values support \n \t \r \\ \xHH and ^X caret notation.
export const triggerActionTypes = [
  { value: 'send', label: 'Send text' },
  { value: 'notify', label: 'Notify only' }
]

export const triggerMatchTypes = [
  { value: 'text', label: 'Text' },
  { value: 'regex', label: 'RegExp' }
]

export const triggerModes = [
  { value: 'cooldown', label: 'Repeat + cooldown' },
  { value: 'repeat', label: 'Repeat every match' },
  { value: 'once', label: 'Once per session' }
]

export const triggerPresets = [
  {
    name: 'Cisco pager: --More--',
    match: { type: 'text', value: '--More--', caseSensitive: false },
    action: { type: 'send', value: ' ' },
    sendEnter: false,
    mode: 'cooldown',
    cooldownMs: 500
  },
  {
    name: 'Pager: Press any key to continue',
    match: { type: 'regex', value: 'press any key|press .* to continue|按任意键', caseSensitive: false },
    action: { type: 'send', value: ' ' },
    sendEnter: false,
    mode: 'cooldown',
    cooldownMs: 800
  },
  {
    name: 'Confirm: Are you sure? [y/n]',
    match: { type: 'regex', value: 'are you sure.*\\[y/n\\]|confirm.*\\(y/n\\)', caseSensitive: false },
    action: { type: 'send', value: 'y' },
    sendEnter: true,
    mode: 'cooldown',
    cooldownMs: 1000
  },
  {
    name: 'Overwrite confirm: Overwrite? (y/n)',
    match: { type: 'regex', value: 'overwrite.*\\(y/n\\)|是否覆盖', caseSensitive: false },
    action: { type: 'send', value: 'y' },
    sendEnter: true,
    mode: 'cooldown',
    cooldownMs: 1000
  },
  {
    name: 'sudo password prompt → notify',
    match: { type: 'regex', value: '\\[sudo\\]\\s*password', caseSensitive: false },
    action: { type: 'notify', value: '' },
    sendEnter: false,
    mode: 'cooldown',
    cooldownMs: 5000
  },
  {
    name: 'SSH new host key → accept once',
    match: { type: 'regex', value: 'are you sure you want to continue connecting', caseSensitive: false },
    action: { type: 'send', value: 'yes' },
    sendEnter: true,
    mode: 'once',
    cooldownMs: 0
  },
  {
    name: 'Telnet login: auto username',
    match: { type: 'regex', value: 'login[: ]*$|username[: ]*$', caseSensitive: false },
    action: { type: 'send', value: '' },
    sendEnter: true,
    mode: 'cooldown',
    cooldownMs: 2000
  },
  {
    name: 'Connection closed → notify',
    match: { type: 'regex', value: 'connection (closed|reset|refused)|lost connection', caseSensitive: false },
    action: { type: 'notify', value: '' },
    sendEnter: false,
    mode: 'cooldown',
    cooldownMs: 5000
  }
]

export function buildTriggerFromPreset (preset, uid) {
  return {
    id: uid(),
    name: preset.name,
    enabled: true,
    match: { ...preset.match },
    action: { ...preset.action },
    sendEnter: preset.sendEnter !== false,
    mode: preset.mode || 'cooldown',
    cooldownMs: preset.cooldownMs == null ? 500 : preset.cooldownMs
  }
}

export function buildEmptyTrigger (uid) {
  return {
    id: uid(),
    name: '',
    enabled: true,
    match: { type: 'text', value: '', caseSensitive: false },
    action: { type: 'send', value: '' },
    sendEnter: true,
    mode: 'cooldown',
    cooldownMs: 500
  }
}
