const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

describe("dicker's hackdio theme", () => {
  test('exposes the built-in hacker palette as a read-only theme', async () => {
    const { dickersHackdioTheme } = await import('../../client/common/theme-defaults.js')

    assert.deepEqual(dickersHackdioTheme(), {
      id: 'dickersHackdio',
      name: "dicker's hackdio",
      type: 'builtin',
      readonly: true,
      uiThemeConfig: {
        'main-dark': '#000000',
        'main-light': '#0f0f0f',
        text: '#00ff41',
        'text-light': '#ffffff',
        'text-dark': '#008800',
        'text-disabled': '#404040',
        primary: '#00ff41',
        info: '#ffcc00',
        success: '#00ff41',
        error: '#ff3333',
        warn: '#ff6600',
        main: '#000000'
      },
      themeConfig: {
        background: '#000000',
        foreground: '#00ff41',
        cursor: '#00ff41',
        selectionBackground: '#0a2a0a',
        cursorAccent: '#000000',
        black: '#000000',
        red: '#ff0040',
        green: '#00ff41',
        yellow: '#ffcc00',
        blue: '#ffab4a',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#555555',
        brightRed: '#ff4466',
        brightGreen: '#44ff66',
        brightYellow: '#ffdd44',
        brightBlue: '#ffab4a',
        brightMagenta: '#ff44ff',
        brightCyan: '#44ffff',
        brightWhite: '#ffffff'
      }
    })
  })
})
