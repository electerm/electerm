/**
 * shortcut-bar data: the candidate button library, the default selection, and
 * localStorage persistence. Pure data (no React) so it can be shared by the
 * bar (shortcut-bar.jsx) and the edit modal (shortcut-bar-edit.jsx).
 */

import * as ls from '../../common/safe-local-storage'
import { shortcutBarLsKey } from '../../common/constants'

// build control bytes at runtime — keeps source free of literal control chars
const ESC = String.fromCharCode(0x1b)
const DEL = String.fromCharCode(0x7f)

// --- candidate library -----------------------------------------------------

const ctrlChars = 'abcdefghijklmnopqrstuvwxyz'.split('')
const ctrlButtons = ctrlChars.map(ch => ({
  id: 'ctrl+' + ch,
  label: 'Ctrl+' + ch.toUpperCase(),
  data: String.fromCharCode(ch.charCodeAt(0) - 96)
}))

const fKeys = [
  ['f1', 'F1', ESC + 'OP'],
  ['f2', 'F2', ESC + 'OQ'],
  ['f3', 'F3', ESC + 'OR'],
  ['f4', 'F4', ESC + 'OS'],
  ['f5', 'F5', ESC + '[15~'],
  ['f6', 'F6', ESC + '[17~'],
  ['f7', 'F7', ESC + '[18~'],
  ['f8', 'F8', ESC + '[19~'],
  ['f9', 'F9', ESC + '[20~'],
  ['f10', 'F10', ESC + '[21~'],
  ['f11', 'F11', ESC + '[23~'],
  ['f12', 'F12', ESC + '[24~']
].map(([id, label, data]) => ({ id, label, data }))

const navButtons = [
  { id: 'esc', label: 'Esc', data: ESC },
  { id: 'tab', label: 'Tab', data: '\t' },
  { id: 'enter', label: 'Enter', data: '\r' },
  { id: 'space', label: 'Space', data: ' ' },
  { id: 'backspace', label: 'Bksp', data: DEL },
  { id: 'arrow-up', label: '↑', data: ESC + '[A' },
  { id: 'arrow-down', label: '↓', data: ESC + '[B' },
  { id: 'arrow-right', label: '→', data: ESC + '[C' },
  { id: 'arrow-left', label: '←', data: ESC + '[D' },
  { id: 'home', label: 'Home', data: ESC + '[H' },
  { id: 'end', label: 'End', data: ESC + '[F' },
  { id: 'pageup', label: 'PgUp', data: ESC + '[5~' },
  { id: 'pagedown', label: 'PgDn', data: ESC + '[6~' },
  { id: 'insert', label: 'Ins', data: ESC + '[2~' },
  { id: 'delete', label: 'Del', data: ESC + '[3~' }
]

const punctChars = ':;/~|\\`\'".,(){}[]<>=+-_*&^%$#@!?'
const punctButtons = punctChars.split('').map(ch => ({
  id: 'char-' + ch.charCodeAt(0),
  label: ch,
  data: ch
}))

// full library, de-duplicated by id
const candidates = []
const seenIds = new Set()
;[...navButtons, ...ctrlButtons, ...fKeys, ...punctButtons].forEach(b => {
  if (!seenIds.has(b.id)) {
    seenIds.add(b.id)
    candidates.push(b)
  }
})

// ids selected by default — mirrors the keys requested in the feature spec
const DEFAULT_ACTIVE_IDS = [
  'esc',
  'tab',
  'ctrl+c',
  'ctrl+v',
  'ctrl+z',
  'ctrl+y',
  'ctrl+a',
  'ctrl+x',
  'ctrl+s',
  'ctrl+f',
  'ctrl+r',
  'ctrl+g',
  'ctrl+h',
  'ctrl+n',
  'ctrl+p',
  'ctrl+l',
  'enter',
  'char-58',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12'
]

export function defaultActive () {
  const byId = new Map(candidates.map(c => [c.id, c]))
  return DEFAULT_ACTIVE_IDS
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(b => ({ ...b }))
}

export function loadActive () {
  const saved = ls.getItemJSON(shortcutBarLsKey, null)
  if (Array.isArray(saved) && saved.length) {
    return saved
  }
  return defaultActive()
}

export function saveActive (arr) {
  ls.setItemJSON(shortcutBarLsKey, arr)
}

export { candidates }
