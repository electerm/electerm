/**
 * Remote shell detection.
 *
 * Kept out of shell.js on purpose: it needs the network (runCmd), which drags
 * the whole app runtime into the import graph. shell.js stays pure so the
 * startup queue can be imported (and unit tested) on its own.
 */
import { runCmd } from './terminal-apis.js'
import { detectShellType } from './shell.js'

export async function detectRemoteShell (pid) {
  // SSH exec runs under the account shell, so prefer the configured shell path
  // instead of probing for any shell binary installed on the host.
  const cmd = 'printf "%s\n" "$SHELL"'

  // { silent: true } so this best-effort probe does not emit a transport-level
  // fetch warning; a single, clearer warning is logged below if it fails.
  const r = await runCmd(pid, cmd, { silent: true })
    .catch((err) => {
      // Non-fatal: the interactive shell already opened, so the terminal keeps
      // working. We just can't inject OSC 633 shell integration for command
      // tracking. This commonly happens when the server limits concurrent
      // sessions (sshd MaxSessions) or the account uses a forced/restricted
      // command, which rejects the auxiliary exec channel with
      // "(SSH) Channel open failure: open failed".
      console.warn('detectRemoteShell: exec channel rejected by server, shell integration disabled, falling back to sh —', err?.message || err)
      return 'sh'
    })

  const shell = r.trim().toLowerCase()

  if (!shell) {
    return 'sh'
  }

  return detectShellType(shell)
}
