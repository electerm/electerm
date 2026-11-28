// These collections carry credentials and share the sync password on upload,
// download, and preview. Other collections are always stored as JSON arrays.
const encryptedDataNames = new Set(['bookmarks', 'profiles', 'aiConfigs'])

export function isJSONArray (str = '') {
  return str.startsWith('[')
}

export async function encodeSyncData (items, pass, dataName) {
  const str = JSON.stringify(items)
  if (pass && encryptedDataNames.has(dataName)) {
    return window.pre.runGlobalAsync('encryptAsync', str, pass)
  }
  return str
}

export async function decryptSyncData (str, pass, dataName) {
  if (!str) return str
  if (isJSONArray(str)) {
    if (pass && encryptedDataNames.has(dataName)) {
      throw new Error(
        'Sync data is plaintext but a sync password is configured. ' +
        'This may indicate the data was tampered with or the sync backend is compromised. ' +
        'Aborting sync download for safety.'
      )
    }
    return str
  }
  return window.pre.runGlobalAsync('decryptAsync', str, pass)
}
