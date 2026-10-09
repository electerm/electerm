const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/main/title-bar-overlay.js')

describe('title bar overlay colors (Windows system title bar)', () => {
  test('parses short, long and alpha hex colors', async () => {
    const { parseHexColor } = await load()
    assert.deepEqual(parseHexColor('#000'), [0, 0, 0])
    assert.deepEqual(parseHexColor('#141314'), [20, 19, 20])
    // alpha is tolerated (and dropped) so a theme color with alpha still works
    assert.deepEqual(parseHexColor('#ffffff80'), [255, 255, 255])
    assert.equal(parseHexColor('red'), null)
  })

  test('uses the theme tab bar color and text color', async () => {
    const { getOverlayColors } = await load()
    const theme = { 'main-dark': '#000', text: '#ddd' }
    assert.deepEqual(getOverlayColors(theme), { color: '#000000', symbolColor: '#dddddd' })
  })

  test('stays opaque regardless of theme alpha', async () => {
    const { getOverlayColors } = await load()
    // the window cannot be see-through in WCO mode, so the overlay must not be
    assert.equal(getOverlayColors({ 'main-dark': '#1e1e1ecc', text: '#fff' }).color, '#1e1e1e')
  })

  test('falls back to defaults for missing or invalid theme colors', async () => {
    const { getOverlayColors } = await load()
    assert.deepEqual(getOverlayColors({ 'main-dark': 'var(--x)' }), { color: '#000000', symbolColor: '#dddddd' })
    assert.deepEqual(getOverlayColors(), { color: '#000000', symbolColor: '#dddddd' })
  })
})
