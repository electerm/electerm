/**
 * The plain parts of credential-provider.jsx, kept apart for the unit tests.
 */

/**
 * The first usable widget that serves passwords.
 * @param {object[]} widgets listWidgets result
 * @return {{id, name, get, save}|null}
 */
export function providerOf (widgets) {
  const w = (widgets || []).find(w => w && w.state === 'ok' && w.info?.credentialProvider?.get)
  if (!w) {
    return null
  }
  const { get, save } = w.info.credentialProvider
  return { id: w.id, name: w.info.name || w.id, get, save: save || '' }
}

// what a provider gets to find the entry, never a password
export function credentialTarget (tab) {
  return {
    type: tab.type || 'ssh',
    host: tab.host,
    port: tab.port,
    username: tab.username || '',
    title: tab.title || ''
  }
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
