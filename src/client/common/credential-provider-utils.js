/**
 * The plain parts of credential-provider.jsx, kept apart for the unit tests.
 */

// bookmark types that authenticate with a password, so a password manager
// widget can serve them
export const PASSWORD_TYPES = ['ssh', 'telnet', 'rdp', 'vnc', 'spice', 'ftp']

// types whose connect actually asks for a login, so a login typed at the
// prompt can be kept afterwards; the others get a session without any prompt
export const CREATE_ENTRY_TYPES = ['ssh', 'rdp']

const typeOf = tab => (tab && tab.type) || 'ssh'

/**
 * Only a bookmark that opts in (`usePasswordManager` in the bookmark form) is
 * ever handed to a password manager, and only while it has no password of its
 * own.
 * @param {object} tab
 * @return {boolean}
 */
export function wantsProvider (tab) {
  return !!tab &&
    !!tab.usePasswordManager &&
    !!tab.host &&
    !tab.password &&
    PASSWORD_TYPES.includes(typeOf(tab))
}

/**
 * Whether a login typed for this bookmark could be stored once the session
 * proved it.
 * @param {object} tab
 * @return {boolean}
 */
export function canCreateEntry (tab) {
  return CREATE_ENTRY_TYPES.includes(typeOf(tab))
}

/**
 * The first usable widget that serves passwords, by id: the pick must not
 * depend on the order in which the widget folders were read.
 * @param {object[]} widgets listWidgets result
 * @return {{id, name, get, save}|null}
 */
export function providerOf (widgets) {
  const w = (widgets || [])
    .filter(w => w && w.state === 'ok' && w.info?.credentialProvider?.get)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]
  if (!w) {
    return null
  }
  const { get, save } = w.info.credentialProvider
  return { id: w.id, name: w.info.name || w.id, get, save: save || '' }
}

// what a provider gets to find the entry, never a password
export function credentialTarget (tab) {
  return {
    type: typeOf(tab),
    host: tab.host,
    port: tab.port,
    // ftp bookmarks keep the user name in `user`
    username: tab.username || tab.user || '',
    title: tab.title || ''
  }
}

/**
 * Connection options from a provider answer; ftp bookmarks keep the user name
 * in `user`.
 * @param {object} creds
 * @param {string} type bookmark type
 * @return {object}
 */
export function credentialOptions (creds, type) {
  if (!creds || !creds.password) {
    return {}
  }
  const opts = { password: creds.password }
  if (creds.username) {
    opts.username = creds.username
    if (type === 'ftp') {
      opts.user = creds.username
    }
  }
  return opts
}

/**
 * A user name or password typed at a one-question prompt.
 * @param {object} options the prompt (session-interactive options)
 * @param {string[]} results the answers
 * @return {{username}|{password}|null}
 */
export function promptAnswer (options, results) {
  if (!options || options.mode === 'confirm' || !results?.length) {
    return null
  }
  const prompts = options.prompts || []
  if (prompts.length !== 1 || !results[0]) {
    return null
  }
  const label = `${options.name || ''} ${prompts[0].prompt || ''}`.toLowerCase()
  if (/password/.test(label) && !prompts[0].echo) {
    return { password: results[0] }
  }
  if (/user|login/.test(label)) {
    return { username: results[0] }
  }
  return null
}
