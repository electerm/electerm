/**
 * Turning a DOM key event into the combo string the shortcut config uses
 * (`ctrl+shift+v`, `meta+↑`, `mouseWheel`…), plus the one rule about paste
 * that the terminal applies on top of it.
 *
 * This lives apart from shortcut-handler.js so it can be unit tested: the
 * handler pulls in the client constants, and through them image assets, which
 * node cannot import.
 *
 * Paste is special in the alternate buffer. A full-screen app (tmux, vim,
 * less) owns the keyboard there, so a bare Ctrl+V has to reach it — vim binds
 * it to visual-block mode (#3115). Only a combo carrying an extra modifier,
 * such as Ctrl+Shift+V, is unambiguous enough to treat as paste (#4656).
 */

import { getKeyCharacter } from './get-key-char.js'

/**
 * The shortcut string for this event, '' when it carries no modifier at all
 * (a plain key belongs to the running program, not to a shortcut).
 */
export function getKeyCombo (event) {
  const {
    code,
    ctrlKey,
    shiftKey,
    metaKey,
    altKey,
    wheelDeltaY,
    button,
    type
  } = event
  let codeName
  if (type === 'mousedown' && button === 1) {
    codeName = 'mouseWheel'
  } else if (
    typeof window !== 'undefined' &&
    typeof window.WheelEvent === 'function' &&
    event instanceof window.WheelEvent
  ) {
    codeName = wheelDeltaY > 0 ? 'mouseWheelUp' : 'mouseWheelDown'
  } else {
    codeName = code
  }
  if (
    type !== 'mousedown' &&
    !ctrlKey &&
    !shiftKey &&
    !metaKey &&
    !altKey
  ) {
    return ''
  }
  if (codeName === 'mouseWheel') {
    return 'mouseWheel'
  }
  return (ctrlKey ? 'ctrl+' : '') +
    (metaKey ? 'meta+' : '') +
    (shiftKey ? 'shift+' : '') +
    (altKey ? 'alt+' : '') +
    getKeyCharacter(codeName).toLowerCase()
}

/**
 * A shortcut config value is a comma separated list ('ctrl+v,ctrl+shift+v').
 */
export function matchesShortcut (combo, shortcut) {
  return !!combo && (shortcut || '')
    .split(',')
    .filter(Boolean)
    .includes(combo)
}

/**
 * In the alternate buffer, is this combo the paste shortcut? A bare Ctrl+V is
 * not: the full-screen app owns it, so it stays a plain 0x16 to the remote.
 */
export function isAltBufferPasteCombo (combo, pasteShortcut, isMac) {
  if (!matchesShortcut(combo, pasteShortcut)) {
    return false
  }
  // Cmd+V: xterm maps it to no key at all, so the browser pastes natively and
  // the app never sees a keystroke. Nothing to route.
  if (isMac) {
    return true
  }
  return combo.includes('shift+') ||
    combo.includes('meta+') ||
    combo.includes('alt+')
}
