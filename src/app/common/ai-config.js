const subscriptionProviders = new Set(['chatgpt', 'supergrok'])
const requiredApiFields = ['baseURLAI', 'modelAI', 'roleAI', 'apiPathAI', 'authHeaderNameAI', 'languageAI']
const requiredSubscriptionFields = ['modelAI', 'roleAI', 'languageAI']

function aiConfigMissing (config = {}) {
  const provider = config.providerAI || 'api'
  const required = subscriptionProviders.has(provider) ? requiredSubscriptionFields : requiredApiFields
  return required.some(key => !config[key])
}

function getAIProviderForChatSession (history, sessionId, globalProvider = 'api') {
  if (!sessionId || !Array.isArray(history)) return globalProvider || 'api'
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]
    if (entry && entry.chatSessionId === sessionId) return entry.providerAI || 'api'
  }
  return globalProvider || 'api'
}

module.exports = { aiConfigMissing, getAIProviderForChatSession }
