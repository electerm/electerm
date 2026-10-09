const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {
  getTitleBarOptions,
  windowBackground
} = require('../../../src/app/lib/title-bar')

const platforms = [true, false]
const modes = [true, false]

describe('title bar window options', () => {
  test('electerm title bar: frameless and transparent, on every platform', () => {
    const expected = {
      frame: false,
      transparent: true,
      titleBarStyle: 'hidden'
    }
    for (const isWin of platforms) {
      assert.deepEqual(getTitleBarOptions(false, isWin), expected)
    }
  })

  test('system title bar off Windows: real frame, native title bar', () => {
    assert.deepEqual(getTitleBarOptions(true, false), {
      frame: true,
      transparent: false,
      titleBarStyle: 'default'
    })
  })

  test('system title bar on Windows: frameless + window controls overlay', () => {
    assert.deepEqual(getTitleBarOptions(true, true), {
      frame: true,
      transparent: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: windowBackground,
        symbolColor: '#dddddd',
        height: 36
      }
    })
  })

  test('the overlay is only ever set for a system title bar on Windows', () => {
    for (const useSystemTitleBar of modes) {
      for (const isWin of platforms) {
        const opts = getTitleBarOptions(useSystemTitleBar, isWin)
        assert.equal(
          'titleBarOverlay' in opts,
          useSystemTitleBar && isWin
        )
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
