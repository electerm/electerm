import { aiConfigDefaults } from '../components/ai/ai-config-props.js'

const routeFields = ['baseURLAI', 'apiPathAI', 'proxyAI', 'authHeaderNameAI']

function publicURL (value, relative = false) {
  if (value === null) return null
  if (!value) return ''
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, relative ? 'https://example.invalid/' : undefined)
    // A custom query or fragment can carry a token or select a different
    // endpoint. Leave the route incomplete instead of guessing its meaning.
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

export function publicAIConfig (config) {
  const { id, nameAI, modelAI, roleAI, languageAI, contextLengthAI, authHeaderNameAI } = config
  return {
    id,
    // A widget can use the provider URL as its account name.
    nameAI: typeof nameAI === 'string' && nameAI.includes('://') ? publicURL(nameAI) || '' : nameAI,
    modelAI,
    roleAI,
    languageAI,
    contextLengthAI,
    baseURLAI: publicURL(config.baseURLAI),
    apiPathAI: publicURL(config.apiPathAI, true),
    proxyAI: publicURL(config.proxyAI),
    // A custom literal header prefix can itself contain a credential.
    authHeaderNameAI: /^[\w-]+(?:: (?:Bearer|Basic|Api-Key))?$/i.test(authHeaderNameAI || '') ? authHeaderNameAI : null,
    credentialsOmitted: true
  }
}

export function restoreAIConfigs (records, localRecords, passwordlessSync = false) {
  const byId = new Map(localRecords.map(record => [record.id, record]))
  return records.map(record => {
    if (!record.credentialsOmitted && !passwordlessSync) return record
    const { credentialsOmitted, ...config } = publicAIConfig(record)
    const local = byId.get(config.id)
    if (local && config.id) {
      const previous = publicAIConfig(local)
      if (routeFields.every(key => config[key] === previous[key])) {
        // When both routes were omitted their contents cannot be compared.
        // Keep the entire trusted local route together with its credentials.
        for (const key of routeFields) config[key] = local[key]
        config.apiKeyAI = local.apiKeyAI
        return config
      }
    }
    // A missing authenticated proxy must not silently become a direct route.
    if (routeFields.some(key => config[key] === null)) config.baseURLAI = ''
    for (const key of routeFields) config[key] ||= ''
    return { ...config, apiKeyAI: '' }
  })
}

export function withoutLegacyAISettings (settings) {
  const clean = { ...settings }
  for (const field of Object.keys(aiConfigDefaults)) delete clean[field]
  return clean
}
