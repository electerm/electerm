/**
 * Decide what a terminal pane does when its connection ends.
 *
 * The signal is how the pty / ssh channel ended, reported by the session
 * server right before the socket closes - never the text the user typed.
 *
 * Why not the typed line: `exit` also leaves a shell nested *inside* the
 * session (su, bash, tmux, a second ssh, a psql / python REPL) while the
 * connection stays up. A tab that remembered "the user typed exit" therefore
 * closed itself on the next unrelated disconnect - idle timeout, a network
 * blip - losing the scrollback and skipping the "session stopped" notice
 * (#4629). An exit at the outermost shell is the only one that ends the pty,
 * so the pty ending is the only honest trigger.
 *
 * This mirrors what mature terminals do: Windows Terminal's `closeOnExit`
 * (graceful = close only on a normal exit, failed = keep the tab) and
 * WezTerm's `exit_behavior` ("CloseOnCleanExit" / "Hold"). Both read the
 * process exit status, and neither has a notion of "the user typed exit".
 *
 * @param {object} options
 * @param {{known: boolean, code: number|null, signal: string|null}|null} options.exitStatus
 *   as sent by the session server; null means the server never reported one
 * @param {boolean} [options.userTypeExit] - fallback for backends that cannot
 *   report a status (telnet, serial, a device that omits SSH exit-status):
 *   the user submitted exit/logout just now
 * @param {boolean} [options.closeOnCleanExit] - product decision, see #4629
 * @returns {{ close: boolean, reason: string }}
 */
export function decideSessionEnd ({
  exitStatus,
  userTypeExit = false,
  closeOnCleanExit = true
}) {
  if (exitStatus && exitStatus.known) {
    // Killed by a signal (SIGKILL, SIGHUP from a dropped link) is not a clean
    // exit even when a status number came along with it.
    if (exitStatus.signal) {
      return { close: false, reason: 'signalled' }
    }
    if (exitStatus.code === 0) {
      return closeOnCleanExit
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
