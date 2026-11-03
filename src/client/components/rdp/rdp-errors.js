/**
 * Readable text for a failed RDP connect. The proxy (app/server/rdp-proxy.js)
 * reports why it could not reach the host as RDCleanPath error fields: a
 * windows socket error, a TLS alert, or 504 when the port answered but the
 * rdp service did not.
 */

// IronError kinds
const kindRDCleanPath = 4
const kindNegotiationFailure = 6

/**
 * the server and the bookmark disagree on NLA
 * @param {object} err IronError
 * @param {boolean} nla the bookmark asked for NLA
 * @return {string} empty: not a negotiation failure
 */
export function negotiationText (err, nla) {
  try {
    if (!err || typeof err.kind !== 'function' || err.kind() !== kindNegotiationFailure) {
      return ''
    }
  } catch (e) {
    return ''
  }
  return nla
    ? 'The server does not accept NLA (CredSSP): turn off "Network level authentication (NLA)" in the bookmark'
    : 'The server requires NLA (CredSSP): turn on "Network level authentication (NLA)" in the bookmark, ' +
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
