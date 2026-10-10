const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createAISubscriptionIpc } = require('../../app/lib/ai-subscription-ipc')

describe('AI subscription IPC allowlist', () => {
  it('returns only safe status, device instructions, and model identifiers', async () => {
    const secret = 'synthetic-oauth-secret'
    const api = createAISubscriptionIpc({
      async getAISubscriptionStatus () { return { supported: true, configured: true, hint: 'connected', accessToken: secret } },
      async signInChatGPT () { return { configured: true, accessToken: secret } },
      cancelChatGPTSignIn () { return { cancelled: true, refreshToken: secret } },
      async beginSuperGrokSignIn () { return { attemptId: 'a1', verificationUrl: 'https://x.ai/activate', userCode: 'ABCD', expiresIn: 600, deviceCode: secret } },
      async finishSuperGrokSignIn () { return { configured: true, accessToken: secret } },
      cancelSuperGrokSignIn () { return { cancelled: true } },
      async signOutAISubscription () { return { signedOut: true, token: secret } },
      async AIlistSubscriptionModels () { return { models: ['grok-4'], refreshToken: secret } }
    })
    const values = [
      await api.getAISubscriptionStatus('chatgpt'),
      await api.signInChatGPT(),
      api.cancelChatGPTSignIn(),
      await api.beginSuperGrokSignIn(),
      await api.finishSuperGrokSignIn('a1'),
      api.cancelSuperGrokSignIn('a1'),
      await api.signOutAISubscription('chatgpt'),
      await api.AIlistSubscriptionModels('chatgpt')
    ]
    assert.equal(JSON.stringify(values).includes(secret), false)
    assert.deepEqual(values[3], { attemptId: 'a1', verificationUrl: 'https://x.ai/activate', userCode: 'ABCD', expiresIn: 600 })
  })
})
