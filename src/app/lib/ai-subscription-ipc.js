function pick (source, keys) {
  const result = {}
  for (const key of keys) {
    if (source && source[key] !== undefined) result[key] = source[key]
  }
  return result
}

function createAISubscriptionIpc (subscriptions) {
  return {
    async getAISubscriptionStatus (providerAI) {
      return pick(await subscriptions.getAISubscriptionStatus(providerAI), ['supported', 'configured', 'hint', 'planUsageEnabled'])
    },
    async signInChatGPT () {
      return pick(await subscriptions.signInChatGPT(), ['supported', 'configured', 'hint', 'planUsageEnabled'])
    },
    cancelChatGPTSignIn () {
      return pick(subscriptions.cancelChatGPTSignIn(), ['cancelled'])
    },
    async beginSuperGrokSignIn () {
      return pick(await subscriptions.beginSuperGrokSignIn(), ['attemptId', 'verificationUrl', 'userCode', 'expiresIn'])
    },
    async finishSuperGrokSignIn (attemptId) {
      return pick(await subscriptions.finishSuperGrokSignIn(attemptId), ['supported', 'configured', 'hint'])
    },
    cancelSuperGrokSignIn (attemptId) {
      return pick(subscriptions.cancelSuperGrokSignIn(attemptId), ['cancelled'])
    },
    async signOutAISubscription (providerAI) {
      return pick(await subscriptions.signOutAISubscription(providerAI), ['signedOut'])
    },
    async AIlistSubscriptionModels (providerAI, proxy) {
      const response = await subscriptions.AIlistSubscriptionModels(providerAI, proxy)
      if (response && response.error) return { error: String(response.error).slice(0, 300) }
      return { models: Array.isArray(response && response.models) ? response.models.filter(model => typeof model === 'string') : [] }
    }
  }
}

module.exports = { createAISubscriptionIpc }
