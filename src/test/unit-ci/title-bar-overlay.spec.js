const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/main/title-bar-overlay.js')

describe('title bar overlay colors (Windows system title bar)', () => {
  test('parses short, long and alpha hex colors', async () => {
    const { parseHexColor } = await load()
    assert.deepEqual(parseHexColor('#000'), [0, 0, 0, 1])
    assert.deepEqual(parseHexColor('#141314'), [20, 19, 20, 1])
    assert.deepEqual(parseHexColor('#ffffff80'), [255, 255, 255, 128 / 255])
    assert.equal(parseHexColor('red'), null)
  })

  test('uses the theme tab bar color and text color', async () => {
    const { getOverlayColors } = await load()
    const theme = { 'main-dark': '#000', text: '#ddd' }
    assert.deepEqual(getOverlayColors(theme), { color: '#000000ff', symbolColor: '#dddddd' })
  })

  test('matches the tab bar see-through when opacity/blur is on', async () => {
    const { getOverlayColors } = await load()
    const theme = { 'main-dark': '#1e1e1e', text: '#fff' }
    assert.equal(getOverlayColors(theme, 0.5, true).color, '#1e1e1e80')
    // opacity only matters when the page is see-through
    assert.equal(getOverlayColors(theme, 0.5, false).color, '#1e1e1eff')
  })

  test('falls back to defaults for missing or invalid theme colors', async () => {
    const { getOverlayColors } = await load()
    assert.deepEqual(getOverlayColors({ 'main-dark': 'var(--x)' }), { color: '#000000ff', symbolColor: '#dddddd' })
  })
})
