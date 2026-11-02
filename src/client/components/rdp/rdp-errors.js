/**
 * Readable text for a failed RDP connect. The proxy (app/server/rdp-proxy.js)
 * reports why it could not reach the host as RDCleanPath error fields: a
 * windows socket error, a TLS alert, or 504 when the port answered but the
 * rdp service did not.
 */

// IronError kinds
const kindRDCleanPath = 4
const kindNegotiationFailure = 6

// IronErrorKind of `err`, -1 when it is no IronError
export function errorKind (err) {
  try {
    if (err && typeof err.kind === 'function') {
      return err.kind()
    }
  } catch (e) {}
  return -1
}

/**
 * The bookmark switch "Without NLA as fallback", on unless turned off.
 */
export function nlaFallbackOf (tab = {}) {
  return tab.nlaFallback !== false
}

/**
 * How to log on. NLA needs the password before the session starts. With the
 * fallback allowed, a session without password, or after a failed NLA logon,
 * starts without NLA and Windows shows its logon screen with the user name
 * filled in. That fallback sends no password, it is typed into the logon
 * screen; unless the bookmark asks for it (`nlaFallbackPassword`): then
 * Windows logs on with it, but without NLA nothing proves the server is the
 * right one before it gets the password.
 * @param {object} o
 * @param {boolean} o.nlaFallback the bookmark allows logons without NLA
 * @param {boolean} o.nlaFallbackPassword send the password without NLA too
 * @param {string} o.password
 * @param {boolean} o.logonScreen this is the fallback
 * @return {{credssp: boolean, password: string}}
 */
export function logonMode ({ nlaFallback, nlaFallbackPassword, password, logonScreen }) {
  return {
    credssp: !logonScreen && !(nlaFallback && !password),
    password: logonScreen && !nlaFallbackPassword ? '' : (password || '')
  }
}

/**
 * What to do after a failed connect.
 * @param {number} kind IronErrorKind
 * @param {object} o
 * @param {boolean} o.nlaFallback the bookmark allows logons without NLA
 * @param {boolean} o.credssp this attempt used NLA
 * @param {boolean} o.logonScreen this attempt was the fallback
 * @return {string} 'logonScreen': try once without NLA; 'askPassword': the
 *   server requires NLA, ask for the password; '': show the error
 */
export function nextLogonStep (kind, { nlaFallback, credssp, logonScreen }) {
  // WrongPassword(1) / LogonFailure(2), or a server without NLA
  const nlaFailed = kind === 1 || kind === 2 || kind === kindNegotiationFailure
  if (credssp && nlaFallback && !logonScreen && nlaFailed) {
    return 'logonScreen'
  }
  if (!credssp && kind === kindNegotiationFailure) {
    return 'askPassword'
  }
  return ''
}

/**
 * the server and the bookmark disagree on NLA
 * @param {object} err IronError
 * @param {boolean} credssp the attempt used NLA
 * @return {string} empty: not a negotiation failure
 */
export function negotiationText (err, credssp) {
  try {
    if (!err || typeof err.kind !== 'function' || err.kind() !== kindNegotiationFailure) {
      return ''
    }
  } catch (e) {
    return ''
  }
  return credssp
    ? 'The server does not accept NLA (CredSSP): turn on "Without NLA as fallback" in the bookmark'
    : 'The server requires NLA (CredSSP): log on with a password, ' +
      'or allow remote connections without network level authentication on the server'
}

/**
 * @param {object} err IronError from ironrdp-wasm
 * @return {{http?: number, wsa?: number, tls?: number} | null}
 */
export function getRDCleanPathDetails (err) {
  try {
    if (!err || typeof err.kind !== 'function' || err.kind() !== kindRDCleanPath) {
      return null
    }
    const d = err.rdcleanpathDetails && err.rdcleanpathDetails()
    if (!d) {
      return null
    }
    return {
      http: d.httpStatusCode,
      wsa: d.wsaErrorCode,
      tls: d.tlsAlertCode
    }
  } catch (e) {
    return null
  }
}

/**
 * @param {{http?: number, wsa?: number, tls?: number} | null} d
 * @param {string} host
 * @param {number} port
 * @return {string} empty: nothing known, show the raw error
 */
export function rdCleanPathText (d, host, port) {
  if (!d) {
    return ''
  }
  const addr = `${host}:${port}`
  switch (d.wsa) {
    case 10060:
      return `${addr} does not answer (connection timed out): the computer is off or asleep, or a firewall blocks remote desktop`
    case 10061:
      return `${addr} refused the connection: the computer is on, but remote desktop is off or listens on another port`
    case 10064:
    case 10065:
    case 10051:
      return `${addr} cannot be reached (no route to host / network unreachable)`
    case 11001:
    case 11002:
      return `${host}: host name not found`
    case 10054:
      return `${addr} reset the connection`
    case 10013:
      return `${addr}: connection not permitted (blocked locally)`
  }
  if (d.tls) {
    return `TLS handshake with ${addr} failed (TLS alert ${d.tls})`
  }
  if (d.http === 504) {
    return `${addr} accepted the connection but sent no remote desktop answer`
  }
  return ''
}
