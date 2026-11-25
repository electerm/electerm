/**
 * Decide what a terminal pane does when its connection ends.
 *
 * The exit status stays the authority, with one asymmetry: a local pty's
 * status describes the process the user ran, while an SSH server's status
 * describes *its* idea of a normal end. Network gear (Comware, IOS) closes
 * an idle-timed-out session through the same "normal" path as a deliberate
 * `quit` and reports 0 for both - SSH has no field for "why", so a zero can
 * not prove the user asked to leave. An SSH tab therefore also needs the
 * submitted line to explain the close.
 *
 * That evidence comes from the keystrokes (`typed-line.js`), not from the
 * device's output: matching vendor wording would be a growing table of
 * per-model strings, and the rendered row can not even be parsed on a
 * `<HOST>exit` prompt. Reading nothing at all is what SecureCRT does - its
 * `Close on disconnect` is off by default and never looks at a status - and
 * what a `never` close policy does in PuTTY / Windows Terminal.
 *
 * @param {object} options
 * @param {{known: boolean, code: number|null, signal: string|null}|null} options.exitStatus
 * @param {boolean} [options.isSsh]
 * @param {boolean} [options.userTypeExit] - the user just submitted exit/logout/quit, or an empty-line EOF
 * @param {boolean} [options.closeOnCleanExit]
 * @returns {{ close: boolean, reason: string }}
 */
export function decideSessionEnd ({
  exitStatus,
  isSsh = false,
  userTypeExit = false,
  closeOnCleanExit = true
}) {
  if (exitStatus?.signal) {
    return { close: false, reason: 'signalled' }
  }
  if (exitStatus?.known) {
    if (exitStatus.code === 0) {
      return closeOnCleanExit && (!isSsh || userTypeExit)
        ? { close: true, reason: 'clean-exit' }
        : { close: false, reason: 'clean-exit-hold' }
    }
    // A non-zero status is a failed session: keep the tab so the output stays
    // readable (Windows Terminal "failed", WezTerm "Hold").
    return { close: false, reason: 'error-exit' }
  }
  if (userTypeExit) {
    return { close: true, reason: 'typed-exit' }
  }
  return { close: false, reason: 'unknown' }
}
