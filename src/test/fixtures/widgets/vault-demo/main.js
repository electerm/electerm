/* eslint-env node */
/**
 * A password-manager shaped widget, the same surface the Passbolt handoff
 * needed from the app: connect with a local key file, search entries, hand a
 * decrypted secret back to the UI. Here it is all fake — the point is the shape.
 */

const state = {
  connected: false,
  serverUrl: '',
  keyPath: ''
}

const entries = [
  { id: '1', name: 'prod-db', uri: 'ssh://10.0.0.12', username: 'root', password: 's3cret' },
  { id: '2', name: 'staging-web', uri: '10.0.0.44', username: 'deploy', password: 'hunter2' }
]

async function connect ({ serverUrl, keyPath } = {}) {
  if (!serverUrl || !keyPath) {
    throw new Error('server url and key file are required')
  }
  state.serverUrl = serverUrl
  state.keyPath = keyPath
  state.connected = true
  return { connected: true, fingerprint: 'FAKE-FINGERPRINT' }
}

async function search (query) {
  if (!state.connected) {
    throw new Error('not connected')
  }
  const q = String(query || '').toLowerCase()
  const matches = entries.filter(item => {
    return !q || [item.name, item.uri, item.username].some(v => v.toLowerCase().includes(q))
  })
  return { matches, scanned: entries.length }
}

// The UI must never receive every password with the search result; it asks for
// the one it is about to use.
async function getSecret (id) {
  const entry = entries.find(item => item.id === id)
  if (!entry) {
    throw new Error('entry not found')
  }
  return { username: entry.username, password: entry.password }
}

async function lock () {
  state.connected = false
  return { connected: false }
}

module.exports = {
  connect,
  search,
  getSecret,
  lock
}
