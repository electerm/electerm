const routeFields = ['baseURLAI', 'apiPathAI', 'proxyAI', 'authHeaderNameAI']

// Older plaintext transfers omitted credentials and kept a sanitized route.
// Match that representation only while restoring records carrying its marker.
function legacyRoute (key, value) {
  if (key === 'authHeaderNameAI') {
    return /^[\w-]+(?:: (?:Bearer|Basic|Api-Key))?$/i.test(value || '') ? value : null
  }
  if (value === null) return null
  if (!value) return ''
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, key === 'apiPathAI' ? 'https://example.invalid/' : undefined)
    if (!url.host || url.hash || [...url.searchParams.keys()].some(key => key !== 'api-version')) {
      return null
    }
    if (!url.username && !url.password) return value
    url.username = ''
    url.password = ''
    return value.startsWith('//') ? url.href.slice(url.protocol.length) : url.href
  } catch {
    return null
  }
}

export function restoreAIConfigs (records, localRecords) {
  if (!records.some(record => record.credentialsOmitted === true)) return records
  const byId = new Map(localRecords.map(record => [record.id, record]))
  return records.map(record => {
    if (record.credentialsOmitted !== true) return record
    const { credentialsOmitted, ...config } = record
    const local = byId.get(config.id)
    if (local && config.id && routeFields.every(key => config[key] === legacyRoute(key, local[key]))) {
      for (const key of routeFields) config[key] = local[key]
      config.apiKeyAI = local.apiKeyAI
      return config
    }
    // A missing authenticated proxy must not silently become a direct route.
    if (routeFields.some(key => config[key] === null)) config.baseURLAI = ''
    for (const key of routeFields) config[key] ||= ''
    return { ...config, apiKeyAI: '' }
  })
}
