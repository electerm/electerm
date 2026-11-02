const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const loadModule = () => import('../../client/components/tabs/detach-tab.js')

const bounds = { x: 100, y: 80, width: 1000, height: 700 }

function event (screenX, screenY, dropEffect = 'none') {
  return {
    screenX,
    screenY,
    dataTransfer: { dropEffect }
  }
}

describe('detach tab drag detection', () => {
  it('does not detach after an accepted drop', async () => {
    const { default: isDragOutsideWindow } = await loadModule()
    assert.equal(isDragOutsideWindow(event(1400, 400, 'move'), bounds), false)
  })

  it('does not detach when the pointer remains inside the window', async () => {
    const { default: isDragOutsideWindow } = await loadModule()
    assert.equal(isDragOutsideWindow(event(100, 80), bounds), false)
    assert.equal(isDragOutsideWindow(event(1100, 780), bounds), false)
    assert.equal(isDragOutsideWindow(event(600, 400), bounds), false)
  })

  it('detects a cancelled drop outside any window edge', async () => {
    const { default: isDragOutsideWindow } = await loadModule()
    assert.equal(isDragOutsideWindow(event(99, 400), bounds), true)
    assert.equal(isDragOutsideWindow(event(1101, 400), bounds), true)
    assert.equal(isDragOutsideWindow(event(600, 79), bounds), true)
    assert.equal(isDragOutsideWindow(event(600, 781), bounds), true)
  })

  it('supports displays at negative screen coordinates', async () => {
    const { default: isDragOutsideWindow } = await loadModule()
    const leftDisplayBounds = { x: -1200, y: -300, width: 1000, height: 700 }
    assert.equal(isDragOutsideWindow(event(-1100, -200), leftDisplayBounds), false)
    assert.equal(isDragOutsideWindow(event(-1300, -200), leftDisplayBounds), true)
  })

  it('ignores incomplete pointer coordinates', async () => {
    const { default: isDragOutsideWindow } = await loadModule()
    assert.equal(isDragOutsideWindow(event(NaN, 400), bounds), false)
  })
})
