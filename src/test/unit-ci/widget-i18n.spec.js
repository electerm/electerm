const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

// The renderer half of widget i18n (client/common/widget-i18n.js). No imports:
// unit-ci loads client modules as ESM, so an extensionless import would fail.

let normalizeLang
let localizeWidgetInfo
let localizeRegistryWidget
let sanitizeWidgetI18n

before(async () => {
  const mod = await import('../../client/common/widget-i18n.js')
  normalizeLang = mod.normalizeLang
  localizeWidgetInfo = mod.localizeWidgetInfo
  localizeRegistryWidget = mod.localizeRegistryWidget
  sanitizeWidgetI18n = mod.sanitizeWidgetI18n
})

const INFO = {
  id: 'tftp-server',
  name: 'Local TFTP Server',
  description: 'Serve a folder over TFTP',
  submitLabel: 'Connect / search',
  configs: [
    {
      name: 'host',
      label: 'Listen address',
      description: 'The interface to bind to',
      placeholder: '0.0.0.0',
      choices: [{ label: 'All', value: '0.0.0.0' }]
    },
    { name: 'port', label: 'Port', description: '' }
  ],
  i18n: {
    zh_cn: {
      name: '本地 TFTP 服务器',
      description: '通过 TFTP 提供文件夹',
      configs: {
        host: { label: '监听地址', choices: { '0.0.0.0': '所有地址' } },
        port: { label: '端口' }
      }
    }
  }
}

describe('widget i18n', () => {
  test('normalizes the locale code electerm stores in window.store', () => {
    assert.equal(normalizeLang('zh_cn'), 'zh_cn')
    assert.equal(normalizeLang('zh-CN'), 'zh_cn')
    assert.equal(normalizeLang('EN_us'), 'en_us')
    assert.equal(normalizeLang(undefined), 'en_us')
    assert.equal(normalizeLang('anything'), 'en_us')
  })

  test('translates the displayed name, description and config labels', () => {
    const res = localizeWidgetInfo(INFO, 'zh_cn')
    assert.equal(res.name, '本地 TFTP 服务器')
    assert.equal(res.description, '通过 TFTP 提供文件夹')
    assert.equal(res.submitLabel, 'Connect / search')
    assert.equal(res.configs[0].label, '监听地址')
    assert.equal(res.configs[0].description, 'The interface to bind to')
    assert.equal(res.configs[0].placeholder, '0.0.0.0')
    assert.equal(res.configs[0].choices[0].label, '所有地址')
    assert.equal(res.configs[1].label, '端口')
    // the original info stays untouched, so a later locale change is clean
    assert.equal(INFO.name, 'Local TFTP Server')
    assert.equal(INFO.configs[0].label, 'Listen address')
  })

  test('falls back to English for a locale the widget did not translate', () => {
    const res = localizeWidgetInfo(INFO, 'fr_fr')
    assert.equal(res, INFO)
    assert.equal(localizeWidgetInfo(INFO, 'en_us').name, 'Local TFTP Server')
  })

  test('localizes registry rows using the same translations', () => {
    const record = {
      id: 'tftp-server',
      name: INFO.name,
      description: INFO.description,
      i18n: INFO.i18n
    }
    assert.equal(localizeRegistryWidget(record, 'zh_cn').name, '本地 TFTP 服务器')
    assert.equal(localizeRegistryWidget(record, 'fr_fr'), record)
  })

  test('drops fields the host never renders from untrusted i18n data', () => {
    const clean = sanitizeWidgetI18n({
      zh_cn: {
        name: '名字',
        type: 'instance',
        description: 'a'.repeat(3000),
        configs: {
          host: { label: '地址', type: 'password', choices: { a: '甲', b: 42 } }
        }
      },
      bad: { name: 'nope' }
    })
    assert.deepStrictEqual(Object.keys(clean), ['zh_cn'])
    assert.equal(clean.zh_cn.name, '名字')
    assert.equal(clean.zh_cn.type, undefined)
    assert.equal(clean.zh_cn.description.length, 2000)
    assert.deepStrictEqual(clean.zh_cn.configs.host, {
      label: '地址',
      choices: { a: '甲' }
    })
  })
})
