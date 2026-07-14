const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

describe('AI configuration presets', () => {
  test('includes MiniMax models for both supported regions', async () => {
    const { defaultAIPresets } = await import('../../src/client/components/ai/ai-config-props.js')
    const presets = defaultAIPresets.filter(preset => preset.id.startsWith('minimax-'))

    assert.deepEqual(
      presets.map(({ id, baseURLAI, apiPathAI, modelAI, authHeaderNameAI }) => ({
        id,
        baseURLAI,
        apiPathAI,
        modelAI,
        authHeaderNameAI
      })),
      [
        {
          id: 'minimax-global-m3',
          baseURLAI: 'https://api.minimax.io/v1',
          apiPathAI: '/chat/completions',
          modelAI: 'MiniMax-M3',
          authHeaderNameAI: 'Authorization: Bearer'
        },
        {
          id: 'minimax-global-m27',
          baseURLAI: 'https://api.minimax.io/v1',
          apiPathAI: '/chat/completions',
          modelAI: 'MiniMax-M2.7',
          authHeaderNameAI: 'Authorization: Bearer'
        },
        {
          id: 'minimax-cn-m3',
          baseURLAI: 'https://api.minimaxi.com/v1',
          apiPathAI: '/chat/completions',
          modelAI: 'MiniMax-M3',
          authHeaderNameAI: 'Authorization: Bearer'
        },
        {
          id: 'minimax-cn-m27',
          baseURLAI: 'https://api.minimaxi.com/v1',
          apiPathAI: '/chat/completions',
          modelAI: 'MiniMax-M2.7',
          authHeaderNameAI: 'Authorization: Bearer'
        }
      ]
    )
  })
})
