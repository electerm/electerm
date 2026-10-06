const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const MODULE = '../../../src/client/common/ui-theme-color.mjs'

// The expected values below were produced by stylus 0.64.0 -- `darken(c, 30%)`
// / `lighten(c, 30%)` -- which is what built `--main-darker` / `--main-lighter`
// before the theme moved to runtime CSS variables (#4072). They pin the
// replacement to the old rendering.
const STYLUS_30 = [
  ['#141314', '#0e0d0e', '#5c585c'],
  ['#ededed', '#a6a6a6', '#f2f2f2'],
  ['#08c', '#005f8f', '#29b8ff'],
  ['#EF476F', '#c8113d', '#f47e9a'],
  ['#06D6A0', '#049670', '#3af9c8'],
  ['#FFD166', '#faaf00', '#ffdf94'],
  ['#2E3338', '#202427', '#65707b'],
  ['#20111b', '#160c13', '#7a4167'],
  ['#ff00ff', '#b300b2', '#ff4dff'],
  ['#abcdef', '#448fdb', '#c4dcf4'],
  ['#010203', '#010102', '#274e75']
]

describe('ui theme derived colours', () => {
  test('matches stylus darken()/lighten() at 30%', async () => {
    const { darker } = await import(MODULE)
    for (const [main, wantDarker, wantLighter] of STYLUS_30) {
      assert.strictEqual(darker(main, 0.3), wantDarker, `${main} darkened`)
      assert.strictEqual(darker(main, -0.3), wantLighter, `${main} lightened`)
    }
  })

  test('does not collapse a dark main to pure black', async () => {
    const { darker } = await import(MODULE)
    // main of the shipped dark theme (src/client/common/theme-defaults.js)
    assert.strictEqual(darker('#121214', 0.3), '#0d0d0e')
    // mains a user theme is likely to pick: dark, but not #000
    const mains = [
      '#121214', '#141314', '#2E3338', '#20111b', '#123456', '#1a2b3c', '#0d0d0d'
    ]
    for (const main of mains) {
      const out = darker(main, 0.3)
      assert.match(out, /^#[0-9a-f]{6}$/, `${main} -> ${out} is not a 6-digit hex`)
      assert.notStrictEqual(out, '#000000', `${main} collapsed to black`)
    }
  })

  test('agrees with the value theme.styl hardcodes for the same main', async () => {
    const { darker } = await import(MODULE)
    // src/client/css/includes/theme.styl sets `--main #141314` alongside
    // `--main-darker #0e0d0e`; the runtime override has to produce the same
    // colour or the app paints differently than the stylesheet was designed for.
    assert.strictEqual(darker('#141314', 0.3), '#0e0d0e')
  })

  test('passes a non-hex value through instead of turning it black', async () => {
    const { adjustLightness, darker } = await import(MODULE)
    for (const value of ['rgba(0, 0, 0, 0.5)', 'transparent', 'not-a-color', '']) {
      assert.strictEqual(adjustLightness(value, -30), value)
      assert.strictEqual(darker(value, 0.3), value)
    }
  })

  test('keeps the direction of the adjustment', async () => {
    const { darker } = await import(MODULE)
    // mid-grey: darker must go down, lighter must go up
    assert.strictEqual(darker('#808080', 0.3), '#5a5a5a')
    assert.strictEqual(darker('#808080', -0.3), '#a6a6a6')
  })
})
