/**
 * Line-ending conversion for sessions that sit directly on a byte stream.
 *
 * SSH and local sessions get their line endings from the pty line discipline
 * (ONLCR/ICRNL), so the terminal never has to care. Serial and telnet have no
 * such layer: whatever the device writes is what the renderer gets, and plenty
 * of embedded gear ends a line with a bare CR (0x0D) - which in a terminal only
 * returns the cursor to column 0, so the next line is printed on top of the
 * current one (#4649).
 *
 * Both directions are opt-in and default to a no-op:
 *   tx: '\r' (default) | '\n' | '\r\n'    - what the Enter key sends
 *   rx: 'none' (default) | 'lf_to_crlf' | 'cr_to_crlf'
 */

const NONE = 'none'
const LF_TO_CRLF = 'lf_to_crlf'
const CR_TO_CRLF = 'cr_to_crlf'

/**
 * Create a stateful RX converter, or null when no conversion is configured.
 *
 * The state is what makes this correct: a chunk boundary has nothing to do
 * with a line boundary, so a CRLF pair - or a run of CRs - can be split across
 * two chunks. Converting each chunk on its own turns such a pair into CRLF+LF,
 * one extra blank line per split. That is exactly what this module exists to
 * avoid, so the conversion looks at the surrounding bytes across chunks
 * instead of only within one.
 *
 * @param {string} mode - 'none' | 'lf_to_crlf' | 'cr_to_crlf'
 * @returns {((str: string) => string) | null}
 */
function createRxConverter (mode) {
  if (!mode || mode === NONE) {
    return null
  }

  if (mode === LF_TO_CRLF) {
    // Only the byte *before* an LF matters, so a look-behind is enough and
    // nothing has to be held back
    let prevCR = false
    return function convertLF (str) {
      if (!str) {
        return str
      }
      let out = ''
      for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        if (ch !== '\n') {
          out += ch
          continue
        }
        const hasCR = i === 0 ? prevCR : str[i - 1] === '\r'
        out += hasCR ? '\n' : '\r\n'
      }
      prevCR = str[str.length - 1] === '\r'
      return out
    }
  }

  if (mode === CR_TO_CRLF) {
    // Emit one line ending for the first CR of a run and swallow the rest of
    // the run, including the LF that closes a CRLF pair. Nothing is held back:
    // a CR at the very end of a chunk has already been emitted, so a stream
    // that stops there still moves the cursor, and the LF that may follow in
    // the next chunk is dropped instead of adding a second line ending.
    let inCRRun = false
    return function convertCR (str) {
      let out = ''
      for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        if (ch === '\r') {
          if (!inCRRun) {
            out += '\r\n'
            inCRRun = true
          }
        } else if (ch === '\n') {
          // Only a bare LF (not the tail of a CR run) needs a CR in front
          if (!inCRRun) {
            out += '\r\n'
          }
          inCRRun = false
        } else {
          out += ch
          inCRRun = false
        }
      }
      return out
    }
  }

  return null
}

/**
 * Rewrite the line endings of outgoing data.
 *
 * '\r' is the default and a no-op: that is what the Enter key already sends,
 * so there is nothing to rewrite. It is also why a lone '\n' is left alone
 * when the mode is CR - a paste of LF-only text is passed through as-is.
 *
 * @param {string} str
 * @param {string} txLineEnding - '\r' | '\n' | '\r\n'
 * @returns {string}
 */
function convertTx (str, txLineEnding) {
  if (!txLineEnding || txLineEnding === '\r') {
    return str
  }
  return str.replace(/\r\n|\r|\n/g, txLineEnding)
}

exports.createRxConverter = createRxConverter
exports.convertTx = convertTx
exports.NONE = NONE
exports.LF_TO_CRLF = LF_TO_CRLF
exports.CR_TO_CRLF = CR_TO_CRLF
