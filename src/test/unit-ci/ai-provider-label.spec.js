const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('AI provider display label', () => {
  it('uses the subscription provider name rather than a retained API URL', async () => {
    const { getAIProviderBrand } = await import('../../client/components/ai/get-brand.js')
    assert.deepEqual(getAIProviderBrand('chatgpt', 'https://api.deepseek.com/v1'), {
      brand: 'ChatGPT',
      brandUrl: 'https://chatgpt.com'
    })
    assert.deepEqual(getAIProviderBrand('supergrok', 'https://api.deepseek.com/v1'), {
      brand: 'SuperGrok',
      brandUrl: 'https://grok.com'
    })
  })

  it('keeps the existing API URL brand resolution', async () => {
    const { getAIProviderBrand } = await import('../../client/components/ai/get-brand.js')
    assert.deepEqual(getAIProviderBrand('api', 'https://api.deepseek.com/v1'), {
      brand: 'Deepseek',
      brandUrl: 'https://deepseek.com'
    })
  })

  it('uses the subscription model instead of an old API name in response badges', async () => {
    const { getAIProviderBadgeLabel } = await import('../../client/components/ai/get-brand.js')
    assert.equal(getAIProviderBadgeLabel('chatgpt', 'Deepseek', 'gpt-6-luna', 'https://api.deepseek.com/v1'), 'ChatGPT:gpt-6-luna')
    assert.equal(getAIProviderBadgeLabel('api', 'My relay', 'model-x', 'https://api.deepseek.com/v1'), 'Deepseek:My relay')
  })
})
