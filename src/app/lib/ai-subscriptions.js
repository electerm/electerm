const axiosDefault = require('axios')
const { createDefaultSubscriptionStorage } = require('./ai-subscription-storage')
const { createChatGPTAuth } = require('./ai-chatgpt-auth')
const { createSuperGrokAuth } = require('./ai-supergrok-auth')
const { createSubscriptionProvider } = require('./ai-subscription-provider')
const { createProxyAgent } = require('./proxy-agent')

function createAISubscriptions ({
  storage = createDefaultSubscriptionStorage(),
  http = axiosDefault,
  openExternal = url => require('electron').shell.openExternal(url),
  isWindows = process.platform === 'win32'
} = {}) {
  const chatgpt = createChatGPTAuth({ storage, http, openExternal })
  const supergrok = createSuperGrokAuth({ storage, http, openExternal })
  const auth = { chatgpt, supergrok }
  const transport = createSubscriptionProvider({
    http,
    getAccessToken: async providerAI => {
      if (!isWindows) throw new Error('AI subscriptions are available only in Windows desktop builds')
      if (!auth[providerAI]) throw new Error('Unsupported subscription provider')
      return auth[providerAI].getAccessToken()
    },
    createProxyAgent
  })

  function unsupported () {
    return { supported: false, configured: false, hint: 'AI subscription sign-in is available only in Windows desktop builds' }
  }

  return {
    getAISubscriptionStatus: async providerAI => {
      if (!isWindows || !auth[providerAI]) return unsupported()
      return auth[providerAI].status()
    },
    signInChatGPT: async () => isWindows ? chatgpt.signIn() : unsupported(),
    cancelChatGPTSignIn: () => chatgpt.cancelSignIn(),
    beginSuperGrokSignIn: async () => isWindows ? supergrok.beginSignIn() : unsupported(),
    finishSuperGrokSignIn: async attemptId => isWindows ? supergrok.finishSignIn(attemptId) : unsupported(),
    cancelSuperGrokSignIn: attemptId => supergrok.cancelSignIn(attemptId),
    signOutAISubscription: async providerAI => {
      if (!isWindows || !auth[providerAI]) return unsupported()
      return auth[providerAI].signOut()
    },
    AIlistSubscriptionModels: async (providerAI, proxy) => {
      if (!isWindows || !auth[providerAI]) return { error: 'AI subscriptions are unavailable on this platform' }
      const base = providerAI === 'chatgpt' ? 'https://api.openai.com/v1/models' : 'https://api.x.ai/v1/models'
      try {
        const token = await auth[providerAI].getAccessToken()
        const config = { headers: { Authorization: `Bearer ${token}` } }
        if (proxy) {
          const agent = createProxyAgent(proxy)
          config.httpAgent = agent
          config.httpsAgent = agent
          config.proxy = false
        }
        const response = await http.get(base, config)
        let models = (response.data && (response.data.data || response.data.models)) || []
        if (!Array.isArray(models)) models = []
        if (providerAI === 'chatgpt') models = models.filter(m => m && m.visibility === 'list')
        const seen = new Set()
        models = models.map(m => typeof m === 'string' ? m : (m && (m.slug || m.id || m.name))).filter(m => {
          if (!m || seen.has(m)) return false
          seen.add(m)
          return true
        })
        return { models }
      } catch (_) {
        return { error: 'Could not load subscription models' }
      }
    },
    chat: options => transport.chat(options),
    abort: requestId => transport.abort(requestId),
    getAccessToken: async providerAI => {
      if (!isWindows) throw new Error('AI subscriptions are unavailable on this platform')
      if (!auth[providerAI]) throw new Error('Unsupported subscription provider')
      return auth[providerAI].getAccessToken()
    }
  }
}

let singleton
function getAISubscriptions () {
  if (!singleton) singleton = createAISubscriptions()
  return singleton
}

module.exports = { createAISubscriptions, getAISubscriptions }
