const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const presetsModule = import('../../client/components/ai/ai-presets.js')
const clientDefaultsModule = import('../../client/common/default-setting.js')
const appDefaults = require('../../app/common/default-setting.js')

describe('Infistar default AI provider', () => {
  it('is the first preset and matches the shipped default settings', async () => {
    const { defaultAIPresets } = await presetsModule
    const infistar = defaultAIPresets[0]
    assert.equal(infistar.id, 'infistar')
    assert.equal(infistar.pinned, true)
    assert.equal(infistar.baseURLAI, 'https://infistar.cc/v1')
    assert.deepEqual(infistar.baseURLAIs, [
      'https://infistar.cc/v1',
      'https://infistar.ai/v1'
    ])
    assert.equal(infistar.aliasURLs, undefined)
    assert.equal(infistar.apiPathAI, '/chat/completions')
    assert.equal(infistar.authHeaderNameAI, 'Authorization: Bearer')
    assert.match(infistar.siteUrl, /^https:\/\/www\.infistar\.cc\/register\?aff=/)

    const clientDefaults = (await clientDefaultsModule).default
    for (const defaults of [clientDefaults, appDefaults]) {
      assert.equal(defaults.nameAI, infistar.nameAI)
      assert.equal(defaults.baseURLAI, infistar.baseURLAI)
      assert.equal(defaults.modelAI, infistar.modelAI)
      assert.equal(defaults.apiPathAI, infistar.apiPathAI)
    }
  })

  it('resolves every provider host, trailing slashes and the build-injected preset', async () => {
    const { defaultAIPresets, findAIPreset, getAIModelOptions, getPresetBaseURLs } = await presetsModule
    const infistar = defaultAIPresets[0]
    assert.deepEqual(getPresetBaseURLs(infistar), infistar.baseURLAIs)
    for (const url of ['https://infistar.cc/v1', 'https://infistar.cc/v1/', 'https://infistar.ai/v1', 'https://infistar.ai/v1/']) {
      assert.equal(findAIPreset(url), infistar)
      assert.deepEqual(getAIModelOptions(url, null), infistar.modelAIs)
    }
    const custom = { id: 'custom', baseURLAI: 'https://ai.example.org/api/ai' }
    assert.equal(findAIPreset('https://ai.example.org/api/ai/', [custom]), custom)
    assert.deepEqual(getPresetBaseURLs(custom), ['https://ai.example.org/api/ai'])
  })
})

describe('Multiple provider base URLs', () => {
  it('keeps one URL list per preset, with the saved URL first', async () => {
    const { defaultAIPresets, getPresetBaseURLs, findAIPreset } = await presetsModule
    for (const preset of defaultAIPresets) {
      assert.equal(preset.aliasURLs, undefined)
      const urls = getPresetBaseURLs(preset)
      assert.ok(urls.length > 0)
      assert.equal(urls[0], preset.baseURLAI)
      for (const url of urls) {
        assert.equal(findAIPreset(url), preset)
      }
    }
  })
})

describe('MiniMax presets and model suggestions', () => {
  it('defaults both direct regions to Flash with M3 as the alternative', async () => {
    const { defaultAIPresets } = await presetsModule
    const presets = defaultAIPresets.filter(p => p.id.startsWith('minimax-'))
    assert.deepEqual(presets.map(p => p.baseURLAI), [
      'https://api.minimax.io/v1', 'https://api.minimax.cn/v1'
    ])
    assert.deepEqual(presets[1].baseURLAIs, [
      'https://api.minimax.cn/v1', 'https://api.minimaxi.com/v1'
    ])
    assert.equal(presets[1].aliasURLs, undefined)
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

describe('Retired model ids in default presets', () => {
  it('does not offer models the provider has already retired', async () => {
    const { defaultAIPresets } = await presetsModule
    const retired = ['gemini-2.0-flash', 'claude-opus-4-1', 'claude-sonnet-4-5']
    for (const preset of defaultAIPresets) {
      const ids = [preset.modelAI, ...(preset.modelAIs || []).map(m => m.value)]
      for (const id of ids) {
        assert.ok(!retired.includes(id), `${preset.id} still offers retired model ${id}`)
      }
    }
  })
})
