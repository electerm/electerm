const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createAISubscriptions } = require('../../app/lib/ai-subscriptions')

function memoryStorage (records = {}) {
  return {
    async get (provider) { return records[provider] || null },
    async set (provider, value) { records[provider] = value },
    async delete (provider) { delete records[provider] },
    async getOrCreateHostId () { return 'host' },
    async getClientId (provider) { return records[`${provider}ClientId`] },
    async setClientId (provider, value) { records[`${provider}ClientId`] = value }
  }
}

describe('AI subscription manager', () => {
  it('reports unsupported on non-Windows and does not issue auth requests', async () => {
    let requests = 0
    const subscriptions = createAISubscriptions({
      storage: memoryStorage(),
      isWindows: false,
      http: { async get () { requests++ }, async post () { requests++ } }
    })
    assert.deepEqual(await subscriptions.getAISubscriptionStatus('chatgpt'), {
      supported: false,
      configured: false,
      hint: 'AI subscription sign-in is available only in Windows desktop builds'
    })
    assert.equal(requests, 0)
  })

  it('uses the fixed model endpoint and filters ChatGPT models to visible entries', async () => {
    const records = { chatgpt: { accessToken: 'token', expiresAt: Date.now() + 3600000, planUsageEnabled: true } }
    const storage = memoryStorage(records)
    let request
    const subscriptions = createAISubscriptions({
      storage,
      isWindows: true,
      http: {
        async get (url, config) {
          request = { url, config }
          return {
            data: {
              data: [
                { id: 'listed-model', visibility: 'list' },
                { id: 'hidden-model', visibility: 'private' }
              ]
            }
          }
        },
        async post () { throw new Error('unexpected auth request') }
      }
    })
    const result = await subscriptions.AIlistSubscriptionModels('chatgpt')
    assert.equal(request.url, 'https://api.openai.com/v1/models')
    assert.equal(request.config.headers.Authorization, 'Bearer token')
    assert.deepEqual(result, { models: ['listed-model'] })
  })
})
