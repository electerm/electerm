// Turns what the user typed into a terminal into quick command steps.
//
// Input arrives as the chunks xterm hands to onData: one chunk per key press,
// or one chunk for a paste. Text is collected into command steps, and Enter
// ends a command step. Other keys become key steps, and a key pressed several
// times in a row becomes one step with a repeat count. Backspace edits the
// text that hasn't been sent yet.
//
// Escape sequences that aren't a known key are dropped. Most of them are
// replies the terminal sends on its own, such as cursor position reports and
// focus events, and replaying those would be wrong.

import { keyNames, keySequence } from './key-sequences.js'

const esc = '\x1b'
const pasteStart = esc + '[200~'
const pasteEnd = esc + '[201~'

// bytes to key name, for both cursor key modes
const sequenceKeys = new Map()
for (const name of keyNames) {
  for (const applicationCursor of [false, true]) {
    const seq = keySequence(name, { applicationCursor })
    if (seq.length > 1 && !sequenceKeys.has(seq)) {
      sequenceKeys.set(seq, name)
    }
  }
}

// Splits one chunk into tokens: { text } or { key }
export function tokenize (chunk) {
  const tokens = []
  const s = String(chunk).split(pasteStart).join('').split(pasteEnd).join('')
  let text = ''
  const flush = () => {
    if (text) {
      tokens.push({ text })
      text = ''
    }
  }
  const pushKey = key => {
    flush()
    tokens.push({ key })
  }
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    const code = ch.charCodeAt(0)
    if (ch === esc) {
      const next = s[i + 1]
      let end = -1
      if (next === '[') {
        // CSI: parameters, then a final byte in @..~
        end = i + 2
        while (end < s.length && !/[@-~]/.test(s[end])) {
          end++
        }
      } else if (next === 'O' && i + 2 < s.length) {
        end = i + 2
      }
      if (end === -1 || end >= s.length) {
        // a lone Esc, or Esc before a plain character (Alt+key)
        pushKey('Esc')
        i++
        continue
      }
      const key = sequenceKeys.get(s.slice(i, end + 1))
      if (key) {
        pushKey(key)
      }
      i = end + 1
      continue
    }
    if (ch === '\r' || ch === '\n') {
      pushKey('Enter')
    } else if (ch === '\t') {
      pushKey('Tab')
    } else if (ch === '\x7f' || ch === '\b') {
      pushKey('Backspace')
    } else if (code < 0x20) {
      pushKey('Ctrl+' + String.fromCharCode(code + 64))
    } else {
      text += ch
    }
    i++
  }
  flush()
  return tokens
}

// Builds steps from the recorded chunks. Every step gets a 0 ms delay.
// makeId is called once per step.
export function recordedSteps (chunks, makeId = () => '') {
  const steps = []
  let buf = ''
  const addCommand = enter => {
    steps.push({ id: makeId(), type: 'command', command: buf, enter, delay: 0 })
    buf = ''
  }
  const addKey = key => {
    const last = steps[steps.length - 1]
    if (last && last.type === 'key' && last.key === key) {
      last.repeat = (last.repeat || 1) + 1
      return
    }
    steps.push({ id: makeId(), type: 'key', key, repeat: 1, delay: 0 })
  }
  for (const chunk of chunks) {
    for (const t of tokenize(chunk)) {
      if (t.text) {
        buf += t.text
      } else if (t.key === 'Backspace' && buf) {
        // drop the last character, keeping surrogate pairs whole
        buf = Array.from(buf).slice(0, -1).join('')
      } else if (t.key === 'Enter' && buf) {
        addCommand(true)
      } else {
        if (buf) {
          addCommand(false)
        }
        addKey(t.key)
      }
    }
  }
  if (buf) {
    addCommand(false)
  }
  return steps
}
