// Named keys for quick command key steps, mapped to the bytes xterm sends when the
// key is pressed. Cursor keys and Home/End switch to SS3 sequences when the
// terminal is in application cursor mode (vi, less, etc.)

const esc = '\x1b'

const plainKeys = {
  enter: '\r',
  tab: '\t',
  esc,
  escape: esc,
  space: ' ',
  backspace: '\x7f',
  delete: esc + '[3~',
  insert: esc + '[2~',
  pageup: esc + '[5~',
  pagedown: esc + '[6~',
  f1: esc + 'OP',
  f2: esc + 'OQ',
  f3: esc + 'OR',
  f4: esc + 'OS',
  f5: esc + '[15~',
  f6: esc + '[17~',
  f7: esc + '[18~',
  f8: esc + '[19~',
  f9: esc + '[20~',
  f10: esc + '[21~',
  f11: esc + '[23~',
  f12: esc + '[24~'
}

// final byte of the cursor key sequences: CSI x normally, SS3 x in
// application cursor mode
const cursorKeys = {
  up: 'A',
  down: 'B',
  right: 'C',
  left: 'D',
  home: 'H',
  end: 'F'
}

export const keyNames = [
  'Enter', 'Tab', 'Esc', 'Space', 'Backspace', 'Delete', 'Insert',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]

// Returns the bytes for a key name such as "Enter", "F5" or "Ctrl+C",
// or '' when the name is unknown. Names are case-insensitive.
export function keySequence (name, { applicationCursor = false } = {}) {
  if (!name) {
    return ''
  }
  const key = String(name).trim().toLowerCase().replace(/\s+/g, '')
  if (Object.hasOwn(plainKeys, key)) {
    return plainKeys[key]
  }
  if (Object.hasOwn(cursorKeys, key)) {
    return esc + (applicationCursor ? 'O' : '[') + cursorKeys[key]
  }
  const ctrl = /^ctrl\+(.)$/.exec(key)
  if (ctrl) {
    const c = ctrl[1].toUpperCase()
    if (/[@A-Z[\\\]^_]/.test(c)) {
      return String.fromCharCode(c.charCodeAt(0) - 64)
    }
  }
  return ''
}

// key names offered in the step editor, named keys first, then Ctrl+A..Z
export const keyOptions = [
  ...keyNames,
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => 'Ctrl+' + c)
]
