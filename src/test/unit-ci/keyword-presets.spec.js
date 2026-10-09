const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadAddon = () => import('../../client/components/terminal/highlight-addon.js')
const loadPresets = () => import('../../client/common/keyword-presets.js')

const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const presetByName = (presets, name) => presets.find(p => p.name === name)

describe('keyword presets', () => {
  test('every Networking rule compiles with the flags the addon uses', async () => {
    const { keywordPresets } = await loadPresets()
    const preset = presetByName(keywordPresets, 'Networking')
    assert.ok(preset)
    for (const { keyword, color } of preset.keywords) {
      assert.doesNotThrow(() => new RegExp(keyword, 'gi'), keyword)
      assert.ok(colors.includes(color))
    }
  })

  test('Networking preset colours typical switch output', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'Networking').keywords)
    const out = addon.highlightKeywords('Gi1/0/3   notconnect   600   26.132.128.13   0011.2233.4455')

    assert.ok(out.includes('\u001b[34mGi1/0/3')) // interface: blue
    assert.ok(out.includes('\u001b[31mnotconnect')) // state: red
    assert.ok(out.includes('\u001b[36m26.132.128.13')) // IP: cyan
    assert.ok(out.includes('\u001b[35m0011.2233.4455')) // MAC: magenta
  })

  test('Networking preset covers other vendors and leaves plain words alone', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'Networking').keywords)
    const blue = '\u001b[34m'
    const interfaces = [
      'ge-0/0/0', 'irb.100', 'ae0', // Juniper
      'Et1', 'Ma1', // Arista
      '1/1/1', 'Trk1', // HPE Aruba CX, ProCurve
      'XGE1/0/1', 'Bridge-Aggregation1', // HP Comware
      'XGigabitEthernet0/0/1', '40GE1/0/1', 'Eth-Trunk1', 'Vlanif10', // Huawei
      'eth1.100', 'switch0', // Ubiquiti EdgeOS
      'ether1', 'sfp-sfpplus1' // MikroTik
    ]
    for (const name of interfaces) {
      assert.ok(addon.highlightKeywords(`port ${name} status`).includes(blue + name), name)
    }
    // EdgeOS state flags and Comware admin down
    assert.ok(addon.highlightKeywords('eth0 u/u').includes('\u001b[32mu/u'))
    assert.ok(addon.highlightKeywords('eth1 A/D').includes('\u001b[31mA/D'))
    assert.ok(addon.highlightKeywords('GE1/0/2 ADM').includes('\u001b[31mADM'))
    const prose = 'the page 5 says ether and ge stay plain on 10/08/26'
    assert.equal(addon.highlightKeywords(prose), prose)
  })

  test('every preset is well formed', async () => {
    const { keywordPresets } = await loadPresets()
    assert.ok(keywordPresets.length > 1)

    const names = new Set()
    for (const preset of keywordPresets) {
      assert.ok(preset.name, 'preset has a name')
      assert.ok(!names.has(preset.name), `duplicate preset name: ${preset.name}`)
      names.add(preset.name)
      assert.ok(preset.description && preset.description.length > 20, `description for ${preset.name}`)
      assert.ok(preset.keywords.length >= 5, `enough rules for ${preset.name}`)

      const seen = new Set()
      for (const { keyword, color } of preset.keywords) {
        assert.ok(keyword, `keyword in ${preset.name}`)
        assert.doesNotThrow(() => new RegExp(keyword, 'gi'), `${preset.name}: ${keyword}`)
        assert.ok(colors.includes(color), `${preset.name}: bad color ${color}`)
        assert.ok(!seen.has(keyword), `${preset.name}: duplicate rule ${keyword}`)
        seen.add(keyword)
      }
    }
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

  test('presets that share a rule only add it once', async () => {
    const { keywordPresets, mergeKeywordPreset } = await loadPresets()
    const names = ['Networking', 'Docker & Kubernetes', 'HTTP & web logs', 'Auth & security']
    const merged = names
      .map(name => presetByName(keywordPresets, name))
      .reduce((acc, preset) => mergeKeywordPreset(acc, preset), [])
    const patterns = merged.map(k => k.keyword)

    assert.equal(new Set(patterns).size, patterns.length)
    // the shared IPv4 rule is in all four of them
    const ipv4 = presetByName(keywordPresets, 'Networking').keywords.find(k => k.color === 'cyan')
    assert.equal(patterns.filter(k => k === ipv4.keyword).length, 1)
  })

  test('Syslog preset colours severity and unit lifecycle', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'Syslog & systemd').keywords)
    const out = addon.highlightKeywords('Oct  9 08:57:36 host systemd[1]: nginx.service: Failed with result exit-code')

    assert.ok(out.includes('\u001b[31mFailed'))
    assert.ok(out.includes('\u001b[34mnginx.service'))
    assert.ok(addon.highlightKeywords('Started nginx.service.').includes('\u001b[32mStarted'))
  })

  test('HTTP preset colours status codes by class', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'HTTP & web logs').keywords)

    assert.ok(addon.highlightKeywords('"GET / HTTP/1.1" 500 1').includes('\u001b[31m500'))
    assert.ok(addon.highlightKeywords('"GET / HTTP/1.1" 404 1').includes('\u001b[33m404'))
    assert.ok(addon.highlightKeywords('"GET / HTTP/1.1" 200 1').includes('\u001b[32m200'))
    // a three-digit number that is not a status code stays plain
    assert.equal(addon.highlightKeywords('the 500 page'), 'the 500 page')
  })

  test('Docker preset keeps pod names whole and colours port mappings', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'Docker & Kubernetes').keywords)
    const out = addon.highlightKeywords('nginx-7d9f8c6b5-x2k4p   0/1   CrashLoopBackOff   12 (30s ago)   5m')

    assert.ok(out.includes('\u001b[35mnginx-7d9f8c6b5-x2k4p'))
    assert.ok(out.includes('\u001b[31mCrashLoopBackOff'))
    assert.ok(out.includes('\u001b[35m12 (30s ago)'))
    assert.ok(addon.highlightKeywords('0.0.0.0:8080->80/tcp').includes('\u001b[35m8080->80/tcp'))
  })

  test('Git preset colours conflicts and leaves the status letters alone', async () => {
    const { keywordPresets } = await loadPresets()
    const { KeywordHighlighterAddon } = await loadAddon()
    const addon = new KeywordHighlighterAddon(presetByName(keywordPresets, 'Git').keywords)
    const conflict = addon.highlightKeywords('CONFLICT (content): Merge conflict in src/x.js')

    assert.ok(conflict.includes('\u001b[31mCONFLICT'))
    assert.ok(conflict.includes('\u001b[34msrc/x.js'))
    // "M " and "??" are too short to colour without hitting ordinary text
    assert.equal(addon.highlightKeywords(' M src/x.js'), ' M \u001b[34msrc/x.js\u001b[0m')
  })
})
