/**
 * Normalize the exit status a session backend reports, so the renderer can
 * decide what to do with the pane from one shape.
 *
 * - ssh2 `channel.on('exit', (code, signal, coreDumped, msg))`
 * - node-pty `term.on('exit', (code, signal))`
 * - telnet / serial: no exit status at all, `known: false`
 *
 * `known: false` is not "exited cleanly": a channel that dies with the
 * transport (network drop, server reboot) never delivers an exit status, and
 * so does a device that does not implement the SSH exit-status request
 * (network gear). The caller must treat it as "we do not know", never as a
 * clean exit - that distinction is what keeps a dropped connection from
 * closing a tab (#4629).
 */

/**
 * @param {number|object|null} code - exit code, or a node-pty style object
 * @param {string|null} signal
 * @returns {{ known: boolean, code: number|null, signal: string|null }}
 */
function normalizeExitStatus (code, signal) {
  // Tolerate `{ exitCode, signal }` too: cheaper than assuming the call site.
  if (code && typeof code === 'object') {
    signal = code.signal
    code = code.exitCode
  }
  const known = typeof code === 'number' && Number.isFinite(code)
  return {
    known,
    code: known ? code : null,
    signal: signal || null
  }
}

exports.normalizeExitStatus = normalizeExitStatus
