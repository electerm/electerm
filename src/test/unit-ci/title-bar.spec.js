const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {
  getTitleBarOptions,
  windowBackground
} = require('../../../src/app/lib/title-bar')

const platforms = [true, false]
const modes = [true, false]

describe('title bar window options', () => {
  test('Windows always: native frame + window controls overlay', () => {
    // useSystemTitleBar is ignored on Windows: the frameless/transparent
    // alternative loses the resize border, shadow and Aero Snap
    const expected = {
      frame: true,
      transparent: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: windowBackground,
        symbolColor: '#dddddd',
        height: 36
      }
    }
    for (const useSystemTitleBar of modes) {
      assert.deepEqual(getTitleBarOptions(useSystemTitleBar, true), expected)
    }
  })

  test('electerm title bar off Windows: frameless and transparent', () => {
    assert.deepEqual(getTitleBarOptions(false, false), {
      frame: false,
      transparent: true,
      titleBarStyle: 'hidden'
    })
  })

  test('system title bar off Windows: real frame, native title bar', () => {
    assert.deepEqual(getTitleBarOptions(true, false), {
      frame: true,
      transparent: false,
      titleBarStyle: 'default'
    })
  })

  test('the overlay is set on every Windows window, and only there', () => {
    for (const useSystemTitleBar of modes) {
      for (const isWin of platforms) {
        const opts = getTitleBarOptions(useSystemTitleBar, isWin)
        assert.equal('titleBarOverlay' in opts, isWin)
      }
    }
  })

  test('a transparent window is always frameless', () => {
    for (const useSystemTitleBar of modes) {
      for (const isWin of platforms) {
        const { frame, transparent } = getTitleBarOptions(useSystemTitleBar, isWin)
        assert.equal(transparent, !frame)
      }
    }
  })

  test('the overlay first paint matches the window background', () => {
    // otherwise a dark caption strip flashes on light themes before the
    // renderer recolors it
    const { titleBarOverlay } = getTitleBarOptions(true, true)
    assert.equal(titleBarOverlay.color, windowBackground)
  })
})
