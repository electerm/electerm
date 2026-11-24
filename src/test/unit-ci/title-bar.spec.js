const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const {
  getTitleBarOptions
} = require('../../../src/app/lib/title-bar')

const platforms = [true, false]
const modes = [true, false]

describe('title bar window options', () => {
  test('Windows keeps caption controls outside web content in either mode', () => {
    const expected = {
      frame: true,
      transparent: false,
      titleBarStyle: 'default'
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

  test('web controls never share a native overlay hit region', () => {
    for (const useSystemTitleBar of modes) {
      for (const isWin of platforms) {
        const opts = getTitleBarOptions(useSystemTitleBar, isWin)
        assert.equal('titleBarOverlay' in opts, false)
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
})
