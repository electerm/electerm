/**
 * The line the user is composing, rebuilt from the input stream.
 *
 * Why not read the rendered row: network gear does not follow the prompt
 * shapes `getCurrentInput` knows (`$ `, `# `, `> ` ... with a trailing
 * space). On a Comware switch the row reads `<NMYC-WH-FH-MSR3600>exit`, so
 * the prompt never matches and the "command" comes out as the whole row -
 * a deliberate `exit` looked like a typo. Keystrokes carry no prompt at
 * all, so this is device independent by construction.
 *
 * This is evidence about what the user asked for, never about why the
 * connection ended: the SSH server's exit status stays the authority for
 * that (it can return 0 after its own idle timeout, see session-end.js).
 *
 * `trusted: false` means text reached the line without passing through
 * here - cursor keys, history recall, bracketed paste, an IME commit. The
 * accumulated line then proves nothing and must not be used.
 */

// Commands that end a session on purpose: unix shells, network gear CLIs.
// A miss only keeps a tab open, which is the safe direction.
const exitCommandReg = /^(?:exit|logout|quit)(?:\s|$)/

export const emptyTypedLine = () => ({ text: '', trusted: true })

/**
 * @param {{text: string, trusted: boolean}} line
 * @param {string} d - one chunk of terminal input
 * @returns {{text: string, trusted: boolean}}
 */
export function applyTypedInput (line, d) {
  // tab completes text the user did not type
  if (!d || d === '\t') {
    return line
  }
  if (d.includes('\x1b')) {
    // escape sequence: the line was changed behind our back
    return { text: line.text, trusted: false }
  }
  if (d === '\x7f' || d === '\b') {
    return line.text
      ? { text: line.text.slice(0, -1), trusted: line.trusted }
      : line
  }
  if (d === '\x03' || d === '\x15') {
    // Ctrl+C / Ctrl+U: the line is gone, and any doubt about it with it
    return emptyTypedLine()
  }
  if (d.length === 1 && d >= ' ' && d < '\x7f') {
    return { text: line.text + d, trusted: line.trusted }
  }
  // an IME commit (multi-byte) or a control key that is not ours
  return { text: line.text, trusted: false }
}

/**
 * Did the user submit a line that ends the session?
 * @param {{text: string, trusted: boolean}} line
 * @returns {boolean}
 */
export function isExitCommandLine (line) {
  return line.trusted === true && exitCommandReg.test(line.text.trim())
}
