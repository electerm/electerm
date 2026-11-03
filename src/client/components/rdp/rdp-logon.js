/**
 * How an rdp session logs on.
 *
 * NLA (CredSSP) is the bookmark's decision, not something the client
 * negotiates on its own: an automatic fallback would give up server
 * authentication silently, and nothing would tell the user it happened.
 *
 * With NLA the password travels inside CredSSP, which also proves the server
 * is the one it claims to be. Without NLA nothing authenticates the server,
 * so the password is not sent at all: the session opens on the Windows logon
 * screen and the user types it there.
 */

/**
 * @param {object} [tab] rdp bookmark or session tab
 * @return {{nla: boolean, password: string}}
 */
export function logonSettings (tab = {}) {
  // absent means on: every bookmark created before the switch existed
  const nla = tab.nla !== false
  return {
    nla,
    password: nla ? (tab.password || '') : ''
  }
}
