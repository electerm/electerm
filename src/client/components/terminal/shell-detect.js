/**
 * Remote shell detection.
 *
 * Kept out of shell.js on purpose: it needs the network (runCmd), which drags
 * the whole app runtime into the import graph. shell.js stays pure so the
 * startup queue can be imported (and unit tested) on its own.
 */
import { execCmd, runCmd } from './terminal-apis.js'
import { parseRemoteShell } from './shell.js'
import { shellName } from './ssh-reload-state.js'

// SSH exec runs under the account shell. Checking $SHELL avoids guessing
// based on which shell binaries happen to be installed on the host.
const accountShellCommand = 'printf "%s\\n" "$SHELL"'
const approvalProbeTimeout = 2000

export async function detectRemoteShell (pid) {
  let r
  try {
    // { silent: true } so this best-effort probe does not emit a
    // transport-level fetch warning; a single, clearer warning is logged
    // below if it fails.
    r = await runCmd(pid, accountShellCommand, { silent: true })
  } catch (err) {
    // Non-fatal: the interactive shell already opened, so the terminal keeps
    // working. This commonly happens when the server limits concurrent
    // sessions (sshd MaxSessions) or the account uses a forced/restricted
    // command, which rejects the auxiliary exec channel with
    // "(SSH) Channel open failure: open failed". A refused channel still
    // means a normal ssh host, so keep assuming a POSIX login shell.
    console.warn('detectRemoteShell: exec channel rejected by server, assuming sh —', err?.message || err)
    return 'sh'
  }

  // Anything that is not a shell path - an error banner, a prompt, nothing -
  // is "unknown", not "sh": injecting there types a Bourne script into a CLI
  // that cannot run it (issue #4610).
  return parseRemoteShell(r)
}

// Approval requires a verified executable. detectRemoteShell assumes 'sh' on
// a refused channel for terminal startup, which would grant an exemption here.
export async function probeAccountShell (pid) {
  let timer
  try {
    // The SSH channel-open timeout can exceed the command timeout.
    const result = await Promise.race([
      execCmd(pid, accountShellCommand, approvalProbeTimeout, { silent: true }),
      new Promise(resolve => { timer = setTimeout(resolve, approvalProbeTimeout) })
    ])
    if (result?.exitCode !== 0 || result.timedOut || result.stderr) return ''
    const path = result.stdout.trim()
    return /^\/(?:[\w.+-]+\/)*[\w.+-]+$/.test(path) ? shellName(path) : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}
