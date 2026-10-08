const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadAddon = () => import('../../client/components/terminal/highlight-addon.js')
const loadPresets = () => import('../../client/common/keyword-presets.js')

describe('keyword presets', () => {
  test('every Networking rule compiles with the flags the addon uses', async () => {
    const { keywordPresets } = await loadPresets()
    const preset = keywordPresets.find(p => p.name === 'Networking')
    assert.ok(preset)
    for (const { keyword, color } of preset.keywords) {
      assert.doesNotThrow(() => new RegExp(keyword, 'gi'), keyword)
      assert.ok(['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].includes(color))
    }
  })

  test('Networking preset colours typical switch output', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(keywordPresets.find(p => p.name === 'Networking').keywords)
    const out = addon.highlightKeywords('Gi1/0/3   notconnect   600   26.132.128.13   0011.2233.4455')

    assert.ok(out.includes('\u001b[34mGi1/0/3')) // interface: blue
    assert.ok(out.includes('\u001b[31mnotconnect')) // state: red
    assert.ok(out.includes('\u001b[36m26.132.128.13')) // IP: cyan
    assert.ok(out.includes('\u001b[35m0011.2233.4455')) // MAC: magenta
  })

  test('applying a preset keeps custom rules and skips duplicates', async () => {
    const { keywordPresets, mergeKeywordPreset } = await loadPresets()
    const preset = keywordPresets[0]
    const existing = [{ color: 'red' }, { keyword: 'mine', color: 'white' }, { ...preset.keywords[0] }]
    const merged = mergeKeywordPreset(existing, preset)

    assert.equal(merged[0].keyword, 'mine')
    assert.equal(merged.length, 1 + preset.keywords.length)
    assert.equal(mergeKeywordPreset(merged, preset).length, merged.length)
  })
})
