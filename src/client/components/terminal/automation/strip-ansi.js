/* eslint-disable no-control-regex */
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g
const OTHER = /\x1b[@-Z\\-_]/g

export const stripAnsi = (s) => {
  if (!s) {
    return ''
  }
  return s.replace(OSC, '').replace(CSI, '').replace(OTHER, '')
}

// \r not followed by \n is treated as line break (progress bar scenes)
export const normalizeCR = (s) => {
  if (!s) {
    return ''
  }
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// a trailing escape sequence that is not finished yet
const partialEscape = /^\x1b(?:\[[0-?]*[ -/]*|O|[@-Z\\-_]?|][^\x07\x1b]*)$/
// a held back sequence that never ends must not grow without limit
const maxCarry = 1024

// Stateful decoder for a stream that arrives in chunks. An escape sequence
// split across two chunks is held back and joined with the next one first:
// ssh output often breaks a color code in the middle, and half a sequence
// would otherwise stay in the text as junk (and break matching on it).
export function createAnsiDecoder () {
  let carry = ''
  return {
    // returns the text of this chunk, colors already stripped
    push (s) {
      if (!s) {
        return ''
      }
      const str = carry + s
      carry = ''
      const esc = str.lastIndexOf('\x1b')
      if (esc >= 0) {
        const tail = str.slice(esc)
        if (tail.length <= maxCarry && partialEscape.test(tail)) {
          carry = tail
          return stripAnsi(str.slice(0, esc))
        }
      }
      return stripAnsi(str)
    },
    // drops a held back sequence, for example after the stream is reset
    reset () {
      carry = ''
    }
  }
}
