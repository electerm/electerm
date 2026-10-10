const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const defaults = require('../../app/common/default-setting')
const { aiConfigMissing, getAIProviderForChatSession } = require('../../app/common/ai-config')
const subscriptionProviders = ['chatgpt', 'supergrok']

describe('AI provider config compatibility', () => {
  it('defaults old configs without a provider to API mode and still requires the API URL', () => {
    assert.equal(defaults.providerAI, 'api')
    assert.equal(aiConfigMissing({ modelAI: 'model', roleAI: 'role', languageAI: 'en' }), true)
    assert.equal(aiConfigMissing({ baseURLAI: 'https://api.test', modelAI: 'model', roleAI: 'role', apiPathAI: '/chat', authHeaderNameAI: 'Authorization', languageAI: 'en' }), false)
  })

  it('does not require API credentials or endpoint fields for subscription providers', () => {
    for (const providerAI of subscriptionProviders) {
      assert.equal(aiConfigMissing({ providerAI, modelAI: 'model', roleAI: 'role', languageAI: 'en' }), false)
    }
  })

  it('requires a selected model for subscription providers', () => {
    assert.equal(aiConfigMissing({ providerAI: 'chatgpt', roleAI: 'role', languageAI: 'en' }), true)
  })

  it('resumes a chat session with its original provider after global settings change', () => {
    const history = [
      { chatSessionId: 'session-a', providerAI: 'supergrok' },
      { chatSessionId: 'session-b', providerAI: 'chatgpt' }
    ]
    assert.equal(getAIProviderForChatSession(history, 'session-a', 'api'), 'supergrok')
    assert.equal(getAIProviderForChatSession([{ chatSessionId: 'old-session' }], 'old-session', 'chatgpt'), 'api')
    assert.equal(getAIProviderForChatSession([], 'new-session', 'chatgpt'), 'chatgpt')
  })
})
