const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const presetsModule = import('../../client/components/ai/ai-presets.js')

describe('MiniMax presets and model suggestions', () => {
  it('defaults both direct regions to Flash with M3 as the alternative', async () => {
    const { defaultAIPresets } = await presetsModule
    const presets = defaultAIPresets.filter(p => p.id.startsWith('minimax-'))
    assert.deepEqual(presets.map(p => p.baseURLAI), [
      'https://api.minimax.io/v1', 'https://api.minimax.cn/v1'
    ])
    for (const preset of presets) {
      assert.equal(preset.modelAI, 'MiniMax-M3.1-Flash')
      assert.equal(preset.apiPathAI, '/chat/completions')
      assert.equal(preset.authHeaderNameAI, 'Authorization: Bearer')
      assert.deepEqual(preset.modelAIs, [
        { value: 'MiniMax-M3.1-Flash' }, { value: 'MiniMax-M3' }
      ])
      // Every preset needs a key page, or the API key label loses its link.
      assert.match(preset.siteUrl, /^https:\/\/platform\.minimaxi?\.(io|com)\/user-center\/basic-information\/interface-key/)
    }
  })

  it('keeps stale API/cache entries out of direct text suggestions without mutating them', async () => {
    const { getAIModelOptions } = await presetsModule
    const cached = ['MiniMax-M2.7', 'MiniMax-M3', 'MiniMax-M3.1-Flash']
    for (const url of ['https://api.minimax.io/v1', 'https://api.minimax.cn/v1/', 'https://api.minimaxi.com/v1/']) {
      assert.deepEqual(getAIModelOptions(url, null, cached), [
        { value: 'MiniMax-M3.1-Flash' }, { value: 'MiniMax-M3' }
      ])
    }
    assert.deepEqual(cached, ['MiniMax-M2.7', 'MiniMax-M3', 'MiniMax-M3.1-Flash'])
  })

  it('merges a freshly fetched list so the refresh button is not a no-op', async () => {
    const { getAIModelOptions } = await presetsModule
    // An explicit fetch is the user asking for the real list: it wins over the
    // curated suggestions, and it is not treated as a stale cache.
    for (const url of ['https://api.minimax.io/v1', 'https://api.minimax.cn/v1', 'https://api.minimaxi.com/v1']) {
      assert.deepEqual(getAIModelOptions(url, null, ['MiniMax-M4', 'MiniMax-M3'], true), [
        { value: 'MiniMax-M3.1-Flash' }, { value: 'MiniMax-M3' }, { value: 'MiniMax-M4' }
      ])
    }
  })

  it('preserves custom endpoint and other provider suggestions', async () => {
    const { getAIModelOptions } = await presetsModule
    const preset = { modelAIs: ['custom-model', { value: 'saved-model' }] }
    for (const url of ['https://custom.example/v1', 'https://api.minimax.io.example/v1']) {
      assert.deepEqual(getAIModelOptions(url, preset, ['MiniMax-M2.7', 'custom-model']), [
        { value: 'custom-model' }, { value: 'saved-model' }, { value: 'MiniMax-M2.7' }
      ])
      // Reload keeps the first fetched model for other endpoints.
      assert.deepEqual(getAIModelOptions(url, null, ['fetched-model']), [{ value: 'fetched-model' }])
    }
  })
})
