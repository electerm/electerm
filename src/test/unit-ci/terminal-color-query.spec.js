const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

describe('terminal OSC color query helpers', () => {
  test('builds OSC color responses from theme hex colors', async () => {
    const { buildOscColorResponse } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')

    assert.strictEqual(
      buildOscColorResponse(11, '#20111b'),
      '\x1b]11;rgb:20/11/1b\x1b\\'
    )
  })

  test('falls back when a transparent theme color cannot describe the visible background', async () => {
    const { buildOscColorResponse } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')

    assert.strictEqual(
      buildOscColorResponse(11, 'rgba(0, 0, 0, 0)', '#121214'),
      '\x1b]11;rgb:12/12/14\x1b\\'
    )
  })

  test('only handles query payloads when registering xterm OSC handlers', async () => {
    const { handleTerminalColorQuery } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')
    const sent = []
    const terminal = {
      input: (data, wasUserInput) => sent.push({ data, wasUserInput })
    }

    assert.equal(handleTerminalColorQuery(terminal, 11, '#20111b', null, '#20111b'), false)
    assert.deepEqual(sent, [])

    assert.equal(handleTerminalColorQuery(terminal, 11, '#20111b', null, '?'), true)
    assert.deepEqual(sent, [
      {
        data: '\x1b]11;rgb:20/11/1b\x1b\\',
        wasUserInput: false
      }
    ])
  })

  test('keeps xterm transparent except when webgl needs an opaque clear background', async () => {
    const { createRendererThemeConfig } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')
    const themeConfig = {
      foreground: '#bbbbbb',
      background: '#20111b'
    }

    // DOM renderer（含降级后的 fallback）永远透明：用户把 renderer 配成 webGL
    // 时，只要实际跑的不是 webGL，就必须让 electerm 自己的 CSS 背景透出来
    assert.deepEqual(
      createRendererThemeConfig(themeConfig, 'dom', '#121214'),
      {
        foreground: '#bbbbbb',
        background: 'rgba(0,0,0,0)'
      }
    )

    assert.deepEqual(
      createRendererThemeConfig(themeConfig, 'canvas', '#121214'),
      {
        foreground: '#bbbbbb',
        background: 'rgba(0,0,0,0)'
      }
    )

    assert.deepEqual(
      createRendererThemeConfig(themeConfig, 'webGL', '#121214'),
      {
        foreground: '#bbbbbb',
        background: '#121214'
      }
    )
  })

  test('theme follows the renderer that is actually active, not the config', async () => {
    const { resolveRendererThemeType } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')
    const rendererTypes = { webGL: 'webGL', dom: 'dom' }

    // 熔断降级 / 激活失败后终端仍配置为 webGL，但手里没有 addon：必须按 dom
    assert.equal(resolveRendererThemeType(true, rendererTypes), 'webGL')
    assert.equal(resolveRendererThemeType(false, rendererTypes), 'dom')
    // 未持有 addon（含 undefined / null）一律当作 DOM
    assert.equal(resolveRendererThemeType(undefined, rendererTypes), 'dom')
    assert.equal(resolveRendererThemeType(null, rendererTypes), 'dom')
  })

  test('blends a translucent selection over the real visible background', async () => {
    const { blendSelectionOverBackground } = await import('../../../src/client/components/terminal/terminal-color-query.mjs')

    // white rgba(255,255,255,0.3) over #20111b -> light semi-transparent highlight
    assert.equal(
      blendSelectionOverBackground('#20111b', 'rgba(255, 255, 255, 0.3)')?.css,
      '#63585f4d'
    )

    // an opaque selection stays fully opaque — never xterm's forced 0.3 alpha
    assert.equal(
      blendSelectionOverBackground('#20111b', '#575256')?.css,
      '#575256ff'
    )
    assert.equal(
      blendSelectionOverBackground('#20111b', '#575256')?.rgba & 0xff,
      0xff
    )

    // invalid background / unparseable or fully transparent selection yield null
    assert.equal(blendSelectionOverBackground('nope', 'rgba(255,255,255,0.3)'), null)
    assert.equal(blendSelectionOverBackground('#20111b', 'nope'), null)
    assert.equal(blendSelectionOverBackground('#20111b', 'rgba(255, 255, 255, 0)'), null)
  })
})
